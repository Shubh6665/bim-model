import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";
import {
  buildUbibotSnapshot,
  estimateBatteryPercentage,
  formatMetricValue,
  pickPrimaryMetricForSensorType,
  ubibotViewChannel,
} from "@/app/services/ubibot";
import { getShellyDeviceStatus, getShellyLocalStatus } from "@/app/services/shelly";

type SensorDoc = {
  _id: any;
  projectId?: string;
  name?: string;
  type?: string;
  value?: string;
  status?: string;
  lastUpdate?: string;
  // UbiBot
  ubibotChannelId?: string;
  ubibotDeviceSerial?: string;
  ubibotFieldMap?: any;
  // Shelly
  sensorProvider?: "ubibot" | "shelly";
  shellyDeviceId?: string;
  shellyAuthKey?: string;
  shellyIpAddress?: string;
  shellyServerUri?: string;
};

// Return type for updates
type SensorUpdate = {
  id: string;
  value: string;
  status: string;
  lastUpdate: string;
  batteryLevel?: number;
  readings?: Record<string, number>;
};

function computeStatusFromChannel(channel: any, sampledAt?: Date): "Online" | "Warning" | "Offline" {
  const net = String(channel?.net ?? "");
  if (net === "0") return "Offline";
  const last = sampledAt?.getTime() || (channel?.last_entry_date ? new Date(channel.last_entry_date).getTime() : NaN);
  if (!Number.isFinite(last)) return "Warning";
  const ageMs = Date.now() - last;
  if (ageMs <= 15 * 60 * 1000) return "Online"; // 15 mins
  if (ageMs <= 60 * 60 * 1000) return "Warning"; // 1 hour
  return "Offline";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json({ message: 'projectId is required' }, { status: 400 });
    }

    const db = await getDb();
    const sensors = (await db.collection("iot_sensors").find({ projectId }).toArray()) as SensorDoc[];

    const now = new Date();
    const updates: Array<SensorUpdate> = [];

    // Fetch all needed Ubibot channels once (per project request)
    const channelIds = Array.from(
      new Set(
        sensors
          .map((s) => (s.ubibotChannelId || "").trim())
          .filter((v) => v.length > 0),
      ),
    );

    const channelMap = new Map<string, any>();
    await Promise.all(
      channelIds.map(async (cid) => {
        try {
          const ch = await ubibotViewChannel(cid);
          channelMap.set(cid, ch);
        } catch (e) {
          console.error(`[IoT Realtime] Error fetching channel ${cid}:`, e);
          // If a channel fails, do not break the whole endpoint.
          channelMap.set(cid, { __error: (e as any)?.message || "Ubibot error" });
        }
      }),
    );

    for (const sensor of sensors) {
      const sensorId = String(sensor._id);
      
      // Handle Shelly Sensors
      if (sensor.sensorProvider === "shelly") {
        try {
          const deviceId = (sensor.shellyDeviceId || "").trim();
          // Use sensor-specific auth key, or fallback to env variable
          const authKey = (sensor.shellyAuthKey || "").trim() || process.env.SHELLY_AUTH_KEY || "";
          const ip = (sensor.shellyIpAddress || "").trim();
          const serverUri = (sensor.shellyServerUri || "").trim() || process.env.SHELLY_CLOUD_SERVER || "https://shelly-238-eu.shelly.cloud";

          console.log(`[IoT Realtime] Fetching Shelly sensor ${sensorId}, device: ${deviceId}, hasAuthKey: ${!!authKey}, serverUri: ${serverUri}`);

          const shellyData = deviceId && authKey
            ? await getShellyDeviceStatus(deviceId, authKey, serverUri)
            : null;

          const fallbackLocal = !shellyData && ip
            ? await getShellyLocalStatus(ip)
            : null;

          const finalData = shellyData || fallbackLocal;
          
          if (finalData) {
            // Determine primary value based on sensor type
            let valueStr = "—";
            if (sensor.type?.toLowerCase().includes("temp")) {
              valueStr = finalData.temperature ? `${finalData.temperature.toFixed(1)}°C` : "—";
            } else if (sensor.type?.toLowerCase().includes("humid")) {
              valueStr = finalData.humidity ? `${finalData.humidity.toFixed(0)}%` : "—";
            }
            
            const status = "Online";
            const lastUpdate = finalData.timestamp || now.toISOString();

            updates.push({
              id: sensorId,
              value: valueStr,
              status,
              lastUpdate,
              batteryLevel: finalData.battery,
              readings: {
                temp: finalData.temperature || 0,
                rh: finalData.humidity || 0,
              }
            });

            // Update sensor document
            await db.collection("iot_sensors").updateOne(
              { _id: new ObjectId(sensorId) },
              {
                $set: {
                  value: valueStr,
                  status,
                  lastUpdate, 
                  batteryLevel: finalData.battery,
                },
              }
            );

            // Store history
            const historyId = `${sensorId}:${lastUpdate}`;
            try {
              await db.collection("iot_sensor_readings").insertOne({
                _id: historyId,
                sensorId,
                projectId,
                deviceId: sensor.shellyDeviceId,
                provider: "shelly",
                ts: new Date(lastUpdate),
                temp: finalData.temperature,
                rh: finalData.humidity,
                battery: finalData.battery,
                createdAt: new Date(),
              } as any);
            } catch (err: any) {
              if (err?.code !== 11000) {
                console.warn("[IoT Realtime] Shelly history insert failed", err?.message || err);
              }
            }
          } else {
            updates.push({
              id: sensorId,
              value: sensor.value || "—",
              status: "Offline",
              lastUpdate: sensor.lastUpdate || now.toISOString(),
            });
          }
        } catch (error) {
          console.error(`Error processing Shelly sensor ${sensorId}:`, error);
          updates.push({ 
            id: sensorId, 
            value: sensor.value || "—", 
            status: "Offline", // Assuming failure means offline or error
            lastUpdate: sensor.lastUpdate || now.toISOString() 
          });
        }
        continue;
      }

      // Handle UbiBot Sensors (legacy check)
      const cid = (sensor.ubibotChannelId || "").trim();

      // Linked to Ubibot
      if (cid) {
        const ch = channelMap.get(cid);
        if (!ch || ch.__error) {
          const status = "Offline";
          updates.push({ id: sensorId, value: sensor.value || "—", status, lastUpdate: sensor.lastUpdate || now.toISOString() });
          continue;
        }

        const snapshot = buildUbibotSnapshot(cid, ch, sensor.ubibotFieldMap);
        const primaryKey = pickPrimaryMetricForSensorType(sensor.type);
        const valueStr = formatMetricValue(snapshot.values[primaryKey], snapshot.units[primaryKey]);
        const status = computeStatusFromChannel(ch, snapshot.sampledAt);
        const lastUpdate = (snapshot.sampledAt || now).toISOString();
        const batteryLevel = estimateBatteryPercentage(snapshot.values.voltage);
        // We do not have signal bars in context yet but we can store it in sensor doc?
        // Actually context Sensor interface has batteryLevel.

        updates.push({ 
          id: sensorId, 
          value: valueStr, 
          status, 
          lastUpdate, 
          batteryLevel,
          readings: snapshot.values as Record<string, number>
        });

        // Persist current reading on sensor doc
        await db.collection("iot_sensors").updateOne(
          { _id: new ObjectId(sensorId) },
          {
            $set: {
              value: valueStr,
              status,
              lastUpdate,
              batteryLevel,
              ubibotChannelId: cid,
              ubibotDeviceSerial: sensor.ubibotDeviceSerial,
              ubibotFieldMap: snapshot.fieldMap,
            },
          },
        );

        // Append history (real only). De-dup using deterministic _id.
        const ts = snapshot.sampledAt || now;
        const historyId = `${sensorId}:${ts.toISOString()}`;
        const historyDoc = {
          _id: historyId,
          sensorId,
          projectId,
          channelId: cid,
          deviceSerial: sensor.ubibotDeviceSerial,
          ts,
          temp: snapshot.values.temp,
          rh: snapshot.values.rh,
          light: snapshot.values.light,
          voltage: snapshot.values.voltage,
          rssi: snapshot.values.rssi,
          createdAt: new Date(),
        };
        try {
          await db.collection("iot_sensor_readings").insertOne(historyDoc as any);
        } catch (err: any) {
          // ignore duplicates
          if (err?.code !== 11000) {
            console.warn("[IoT Realtime API] history insert failed", err?.message || err);
          }
        }
        continue;
      }

      // Not linked: return stored value (no fake generation)
      updates.push({
        id: sensorId,
        value: sensor.value || "—",
        status: (sensor.status as any) || "Warning",
        lastUpdate: sensor.lastUpdate || now.toISOString(),
      });
    }

    return NextResponse.json({ updates, timestamp: now.toISOString() }, { status: 200 });
  } catch (error) {
    console.error("/api/iot/realtime failed:", error);
    return NextResponse.json({ message: "Failed to get realtime data" }, { status: 500 });
  }
}
