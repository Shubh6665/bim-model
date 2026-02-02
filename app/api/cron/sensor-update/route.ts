import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ubibotViewChannel, buildUbibotSnapshot, pickPrimaryMetricForSensorType, formatMetricValue, estimateBatteryPercentage } from "@/app/services/ubibot";

export const dynamic = 'force-dynamic'; // Prevent caching
export const maxDuration = 60; // Allow longer execution (up to 60s on Vercel/Railway default)

async function updateSensors() {
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

    const results = await updateSensors();
    console.log(`[Cron] Successfully updated ${results.length} sensors.`);
    return NextResponse.json({ success: true, updated: results.length });
  } catch (error) {
    console.error("[Cron] Global error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
