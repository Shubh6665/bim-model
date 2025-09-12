import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";

// Utility to parse date params safely
function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

// Generate evenly spaced timestamps between start and end (inclusive)
function generateTimestamps(start: Date, end: Date, resolution: number): string[] {
  if (resolution < 2) resolution = 2;
  const startMs = start.getTime();
  const endMs = end.getTime();
  const step = (endMs - startMs) / (resolution - 1);
  const arr: string[] = [];
  for (let i = 0; i < resolution; i++) {
    arr.push(new Date(startMs + step * i).toISOString());
  }
  return arr;
}

// Simple PRNG for reproducibility based on sensorId hash
function seededRandom(seedStr: string) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => {
    // xorshift32
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17; seed >>>= 0;
    seed ^= seed << 5;  seed >>>= 0;
    return (seed & 0xfffffff) / 0xfffffff;
  };
}

// Generate a time series with gentle variation
function generateSeries(base: number, amp: number, count: number, rnd: () => number, integer = false): number[] {
  const out: number[] = [];
  let val = base + (rnd() - 0.5) * amp * 0.2;
  for (let i = 0; i < count; i++) {
    // smooth random walk
    const delta = (rnd() - 0.5) * amp * 0.05;
    val += delta;
    // clamp to base ± amp
    val = Math.min(base + amp, Math.max(base - amp, val));
    out.push(integer ? Math.round(val) : parseFloat(val.toFixed(1)));
  }
  return out;
}

export async function GET(request: Request) {
  try {
    console.log('[IoT Samples API] Request received at', new Date().toISOString());
    const { searchParams } = new URL(request.url);
    const start = parseDate(searchParams.get("start"), new Date(Date.now() - 24 * 3600 * 1000));
    const end = parseDate(searchParams.get("end"), new Date());
    const resolution = Math.max(8, Math.min(256, parseInt(searchParams.get("resolution") || "32", 10)));

    // Load sensors from DB (so it respects your current project flow)
    // If projectId is provided, filter; otherwise return for all projects
    const projectId = searchParams.get("projectId");
    const db = await getDb();
    const query: any = projectId ? { projectId } : {};
    const sensors = await db.collection("iot_sensors").find(query).toArray();
    console.log(`[IoT Samples API] Found ${sensors.length} sensors for query:`, query);

    // Build timestamps and random data map similar to APS demo shape
    const timestamps = generateTimestamps(start, end, resolution);
    const data: Record<string, Record<string, number[]>> = {};
    // Group sensors by external identity if available
    type Doc = { _id: any; type?: string; externalId?: string; devsn?: string } & Record<string, any>;
    const byGroup = new Map<string, Doc[]>();
    for (const s of sensors as Doc[]) {
      const groupKey = (s.externalId && String(s.externalId)) || (s.devsn && String(s.devsn)) || String(s._id);
      const arr = byGroup.get(groupKey) || [];
      arr.push(s);
      byGroup.set(groupKey, arr);
      console.log(`[IoT Samples API] Sensor ${s._id} grouped under key: ${groupKey}`);
    }
    console.log(`[IoT Samples API] Created ${byGroup.size} sensor groups for data merging`);

    // Channels: temp, rh, co2, pressure (match /api/iot/channels)
    const CHANNELS = ["temp", "rh", "co2", "pressure"];

    for (const [groupKey, groupSensors] of byGroup.entries()) {
      const first = groupSensors[0];
      const seedId = groupKey; // stable seed across duplicates
      const rnd = seededRandom(seedId);
      const count = timestamps.length;
      const type = (first?.type || "").toLowerCase();
      const tempBase = type.includes("temp") ? 24.0 : 23.5;
      const rhBase = 48.0;
      const co2Base = 650;
      const pBase = 1012.0;
      const temp = generateSeries(tempBase, 1.5, count, rnd, false);
      const rh = generateSeries(rhBase, 4.0, count, rnd, false);
      const co2 = generateSeries(co2Base, 60, count, rnd, true);
      const pressure = generateSeries(pBase, 2.0, count, rnd, false);
      // Assign the same merged series to all sensors in the group
      for (const s of groupSensors) {
        const sensorId = String(s._id);
        data[sensorId] = { temp, rh, co2, pressure };
        console.log(`[IoT Samples API] Assigned series to sensor ${sensorId} (group: ${groupKey})`);
      }
    }

    return NextResponse.json({ timestamps, data }, { status: 200 });
  } catch (error) {
    console.error("/api/iot/samples failed:", error);
    return NextResponse.json({ message: "Failed to load samples" }, { status: 500 });
  }
}
