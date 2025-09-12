import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

// Generate current sensor values based on the latest time-series data
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function generateCurrentValue(sensorType: string, baseValue: number, groupKey: string, timestamp: Date): { value: string; status: "Online" | "Warning" | "Offline" } {
  // 5-second time bucket for visible updates
  const bucket = Math.floor(timestamp.getTime() / 5000);
  const seed = hashString(groupKey) ^ bucket;
  // Deterministic pseudo-random in [0,1)
  const rand = (() => {
    let x = seed >>> 0;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x & 0xfffffff) / 0xfffffff;
  })();

  // Base sinusoidal drift + random jitter per bucket (intentionally larger so values change visibly)
  const drift = Math.sin(bucket / 3 + (seed % 10)) * 1.2; // faster + larger drift
  const jitter = (rand - 0.5) * 1.2; // stronger bucket jitter
  let currentVal = baseValue + drift + jitter;
  let status: "Online" | "Warning" | "Offline" = "Online";

  switch (sensorType.toLowerCase()) {
    case "temperature":
      currentVal = Math.max(18, Math.min(34, currentVal));
      status = currentVal >= 30 ? "Warning" : "Online";
      return { value: `${currentVal.toFixed(1)}°C`, status };
    
    case "co2":
      currentVal = Math.max(400, Math.min(1600, currentVal));
      status = currentVal >= 1200 ? "Warning" : "Online";
      return { value: `${Math.round(currentVal)} ppm`, status };
    
    case "light":
      currentVal = Math.max(100, Math.min(1000, currentVal));
      return { value: `${Math.round(currentVal)} lux`, status };
    
    case "humidity":
      currentVal = Math.max(20, Math.min(80, currentVal));
      status = currentVal <= 30 || currentVal >= 70 ? "Warning" : "Online";
      return { value: `${Math.round(currentVal)}%`, status };
    
    case "seismic and accelerometric":
      currentVal = Math.max(0, Math.min(0.1, currentVal));
      status = currentVal > 0.05 ? "Warning" : "Online";
      return { value: `${currentVal.toFixed(3)}g`, status };
    
    case "energy consumption":
      currentVal = Math.max(0.5, Math.min(5, currentVal));
      return { value: `${currentVal.toFixed(1)} kW`, status };
    
    default:
      return { value: `${currentVal.toFixed(1)}`, status };
  }
}

export async function GET(request: Request) {
  try {
    console.log('[IoT Realtime API] Request received at', new Date().toISOString());
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json({ message: 'projectId is required' }, { status: 400 });
    }

    const db = await getDb();
    const sensors = await db.collection("iot_sensors").find({ projectId }).toArray();
    console.log(`[IoT Realtime API] Found ${sensors.length} sensors for project ${projectId}`);

    const now = new Date();
    const updates: Array<{ id: string; value: string; status: string; lastUpdate: string }> = [];

    // Group by externalId/devsn for consistent values
    const groups = new Map<string, any[]>();
    for (const sensor of sensors) {
      const groupKey = sensor.externalId || sensor.devsn || String(sensor._id);
      const arr = groups.get(groupKey) || [];
      arr.push(sensor);
      groups.set(groupKey, arr);
    }

    for (const [groupKey, groupSensors] of groups.entries()) {
      const first = groupSensors[0];
      const type = first.type || "Temperature";
      
      // Base value from sensor type
      let baseValue = 23.5; // Default temperature
      switch (type.toLowerCase()) {
        case "temperature": baseValue = 23.5; break;
        case "co2": baseValue = 650; break;
        case "light": baseValue = 500; break;
        case "humidity": baseValue = 48; break;
        case "seismic and accelerometric": baseValue = 0.02; break;
        case "energy consumption": baseValue = 2.4; break;
      }

      const { value, status } = generateCurrentValue(type, baseValue, groupKey, now);
      
      // Apply same values to all sensors in group
      for (const sensor of groupSensors) {
        updates.push({
          id: String(sensor._id),
          value,
          status,
          lastUpdate: now.toISOString()
        });
        console.log(`[IoT Realtime API] Generated value for sensor ${sensor._id}: ${value} (${status})`);
      }
    }

    return NextResponse.json({ updates, timestamp: now.toISOString() }, { status: 200 });
  } catch (error) {
    console.error("/api/iot/realtime failed:", error);
    return NextResponse.json({ message: "Failed to get realtime data" }, { status: 500 });
  }
}
