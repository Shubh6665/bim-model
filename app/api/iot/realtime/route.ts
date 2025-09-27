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

// PRNG compatible with /api/iot/samples for alignment
function seededRandom(seedStr: string) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17; seed >>>= 0;
    seed ^= seed << 5;  seed >>>= 0;
    return (seed & 0xfffffff) / 0xfffffff;
  };
}

function generateSeries(base: number, amp: number, count: number, rnd: () => number, integer = false): number[] {
  const out: number[] = [];
  let val = base + (rnd() - 0.5) * amp * 0.2;
  for (let i = 0; i < count; i++) {
    const delta = (rnd() - 0.5) * amp * 0.05;
    val += delta;
    val = Math.min(base + amp, Math.max(base - amp, val));
    out.push(integer ? Math.round(val) : parseFloat(val.toFixed(1)));
  }
  return out;
}

function generateTempSeries(count: number, rnd: () => number): number[] {
  const out: number[] = [];
  let val = 24 + (rnd() - 0.5) * 4;
  let spikeLeft = 0; let spikeAmp = 0;
  const clamp = (x: number) => Math.max(18, Math.min(42, x));
  for (let i = 0; i < count; i++) {
    const phase = count > 1 ? i / (count - 1) : 0.5;
    const wave = Math.sin(Math.PI * phase);
    const baseline = 22 + 10 * wave;
    const walk = (rnd() - 0.5) * 1.2;
    val += walk;
    val += (baseline - val) * 0.12;
    if (spikeLeft <= 0 && rnd() < 0.04) {
      spikeLeft = 2 + Math.floor(rnd() * 4);
      const up = rnd() < 0.7;
      spikeAmp = (up ? 4 : -3) + (rnd() * (up ? 6 : 3));
    }
    if (spikeLeft > 0) {
      const factor = spikeLeft / (spikeLeft + 2);
      val += spikeAmp * factor * 0.6;
      spikeLeft--;
    }
    val = clamp(val);
    out.push(parseFloat(val.toFixed(1)));
  }
  return out;
}

function generateCurrentValue(sensorType: string, baseValue: number, groupKey: string, timestamp: Date): { value: string; status: "Online" | "Warning" | "Offline" } {
  // 1-second time bucket for visible updates so values can change each second
  const bucket = Math.floor(timestamp.getTime() / 1000);
  const seed = hashString(groupKey) ^ bucket;
  // Deterministic pseudo-random in [0,1)
  const rand = (() => {
    let x = seed >>> 0;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x & 0xfffffff) / 0xfffffff;
  })();

  let currentVal = baseValue;
  let status: "Online" | "Warning" | "Offline" = "Online";

  switch (sensorType.toLowerCase()) {
    case "temperature": {
      // Compute today's series (96 points) and interpolate to the exact time-of-day
      const rnd = seededRandom(groupKey);
      const count = 96;
      const start = new Date(timestamp); start.setHours(0,0,0,0);
      const end = new Date(start); end.setHours(23,59,59,999);
      const series = generateTempSeries(count, rnd);
      const frac = Math.min(1, Math.max(0, (timestamp.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
      const pos = frac * (count - 1);
      const i0 = Math.floor(pos);
      const i1 = Math.min(count - 1, i0 + 1);
      const alpha = pos - i0;
      let base = series[i0] + (series[i1] - series[i0]) * alpha;
      // Add fast micro-oscillation (≈60s period) with per-sensor phase
      const phaseOffset = (hashString(groupKey) % 60) / 60; // 0..1
      const fastWave = Math.sin(2 * Math.PI * ((timestamp.getTime() / 1000) / 60 + phaseOffset)) * 0.25; // ±0.25°C
      // Jitter per 1s bucket so value changes frequently
      const jitter = (rand - 0.5) * 0.6; // ±0.3°C
      currentVal = Math.max(18, Math.min(42, base + fastWave + jitter));
      status = currentVal >= 30 ? "Warning" : "Online";
      return { value: `${currentVal.toFixed(1)}°C`, status };
    }
    
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
