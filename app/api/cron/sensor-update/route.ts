import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ubibotViewChannel, buildUbibotSnapshot, pickPrimaryMetricForSensorType, formatMetricValue, estimateBatteryPercentage } from "@/app/services/ubibot";
import { getShellyDeviceStatus } from "@/app/services/shelly";

export const dynamic = 'force-dynamic'; // Prevent caching
export const maxDuration = 60; // Allow longer execution (up to 60s on Vercel/Railway default)

async function updateShellySensors() {
  const db = await getDb();
  
  // Find Shelly sensors
  const sensors = await db.collection("iot_sensors").find({
    sensorProvider: "shelly",
    shellyDeviceId: { $ne: null, $exists: true }
  }).toArray();

  console.log(`[Cron Shelly] Found ${sensors.length} Shelly sensors to update.`);

  const results = await Promise.allSettled(sensors.map(async (sensor: any) => {
    try {
      const deviceId = (sensor.shellyDeviceId || "").trim();
      if (!deviceId) return { id: sensor._id, skipped: true };

      // Use sensor-specific auth key or fallback to env variable
      const authKey = (sensor.shellyAuthKey || "").trim() || process.env.SHELLY_AUTH_KEY || "";
      const serverUri = (sensor.shellyServerUri || "").trim() || process.env.SHELLY_CLOUD_SERVER || "https://shelly-238-eu.shelly.cloud";

      if (!authKey) {
        console.warn(`[Cron Shelly] No auth key for sensor ${sensor._id}`);
        return { id: sensor._id, error: "No auth key configured" };
      }

      const data = await getShellyDeviceStatus(deviceId, authKey, serverUri);
      
      if (!data) {
        await db.collection("iot_sensors").updateOne(
          { _id: sensor._id },
          { $set: { status: "Offline", lastUpdate: new Date().toISOString() } }
        );
        return { id: sensor._id, status: 'offline' };
      }

      // Determine primary value based on sensor type
      let valueStr = "—";
      const sensorType = (sensor.type || "").toLowerCase();
      if (sensorType.includes("temp") || sensorType.includes("hum")) {
        if (data.temperature !== undefined) {
          valueStr = `${data.temperature.toFixed(1)}°C`;
        }
      } else if (sensorType.includes("humid")) {
        if (data.humidity !== undefined) {
          valueStr = `${Math.round(data.humidity)}%`;
        }
      } else {
        // Default to temperature
        if (data.temperature !== undefined) {
          valueStr = `${data.temperature.toFixed(1)}°C`;
        }
      }

      // Determine status based on data freshness
      const lastUpdate = data.timestamp ? new Date(data.timestamp) : new Date();
      const hoursSinceLast = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      let status = data.online ? "Online" : "Offline";
      if (hoursSinceLast > 24) status = "Offline";
      else if (hoursSinceLast > 2) status = "Warning";

      await db.collection("iot_sensors").updateOne(
        { _id: sensor._id },
        {
          $set: {
            value: valueStr,
            status,
            batteryLevel: data.battery ?? sensor.batteryLevel ?? 100,
            lastUpdate: new Date().toISOString(),
            rawShellyData: data
          }
        }
      );

      // Store history reading
      const historyId = `${sensor._id}:${lastUpdate.toISOString()}`;
      try {
        await db.collection("iot_sensor_readings").insertOne({
          _id: historyId,
          sensorId: String(sensor._id),
          projectId: sensor.projectId,
          deviceId: deviceId,
          provider: "shelly",
          ts: lastUpdate,
          temp: data.temperature,
          rh: data.humidity,
          battery: data.battery,
          createdAt: new Date(),
        } as any);
      } catch (err: any) {
        if (err?.code !== 11000) {
          console.warn("[Cron Shelly] History insert failed", err?.message);
        }
      }

      return { id: sensor._id, status: 'updated', value: valueStr };
    } catch (err) {
      console.error(`[Cron Shelly] Error updating sensor ${sensor._id}:`, err);
      return { id: sensor._id, error: String(err) };
    }
  }));

  return results;
}

async function updateUbibotSensors() {
  const db = await getDb();
  // Find sensors linked to Ubibot
  const sensors = await db.collection("iot_sensors").find({
    ubibotChannelId: { $ne: null }
  }).toArray();

  console.log(`[Cron] Found ${sensors.length} sensors to update.`);

  const results = await Promise.allSettled(sensors.map(async (sensor: any) => {
    try {
      if (!sensor.ubibotChannelId) return;

      const channel = await ubibotViewChannel(sensor.ubibotChannelId);
      if (!channel) return;

      const snapshot = buildUbibotSnapshot(sensor.ubibotChannelId, channel);
      const metricKey = pickPrimaryMetricForSensorType(sensor.type);
      const valueRaw = snapshot.values[metricKey];
      const unit = snapshot.units[metricKey];
      const valueFormatted = formatMetricValue(valueRaw, unit);

      // Determine status
      // If last entry is older than 1 hour, mark as Offline?
      // Ubibot gives 'last_values' timestamp.
      const lastEntryTime = snapshot.sampledAt?.getTime() || 0;
      const hoursSinceLast = (Date.now() - lastEntryTime) / (1000 * 60 * 60);
      let status = "Online";
      if (hoursSinceLast > 24) status = "Offline";
      else if (hoursSinceLast > 1) status = "Warning";

      // Battery (if available) - usually in voltage or custom field
      // We can try to infer from snapshot values if we mapped 'voltage'
      let batteryLevel = sensor.batteryLevel || 100;
      if (snapshot.values.voltage) {
         batteryLevel = estimateBatteryPercentage(snapshot.values.voltage);
      }

      await db.collection("iot_sensors").updateOne(
        { _id: sensor._id },
        {
          $set: {
            value: valueFormatted,
            status: status,
            batteryLevel: batteryLevel,
            lastUpdate: new Date().toISOString(),
            rawSnapshot: snapshot // Optional: Store full data for history/debug
          }
        }
      );
      return { id: sensor._id, status: 'updated' };
    } catch (err) {
      console.error(`[Cron] Error updating sensor ${sensor._id}:`, err);
      // Don't fail the whole job
      return { id: sensor._id, error: String(err) };
    }
  }));

  return results;
}

export async function GET(request: Request) {
  try {
    // Secure with CRON_SECRET - required for production
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn("[Cron] WARNING: CRON_SECRET is not set! Endpoint is exposed.");
      return NextResponse.json({ message: 'CRON_SECRET not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Cron] Unauthorized access attempt. Invalid or missing auth header.");
      return NextResponse.json({ message: 'Unauthorized - Invalid credentials' }, { status: 401 });
    }

    // Update both Ubibot and Shelly sensors
    const [ubibotResults, shellyResults] = await Promise.all([
      updateUbibotSensors(),
      updateShellySensors()
    ]);

    const totalUpdated = ubibotResults.length + shellyResults.length;
    console.log(`[Cron] Successfully updated ${ubibotResults.length} Ubibot sensors and ${shellyResults.length} Shelly sensors.`);
    
    return NextResponse.json({ 
      success: true, 
      updated: totalUpdated,
      ubibot: ubibotResults.length,
      shelly: shellyResults.length
    });
  } catch (error) {
    console.error("[Cron] Global error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
