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

type ReadingDoc = {
  sensorId: string;
  projectId: string;
  ts: Date;
  temp?: number;
  rh?: number;
  co2?: number;
  pressure?: number;
  magnitude?: number;
  acceleration?: number;
  frequency?: number;
  displacement?: number;
  production?: number;
  light?: number;
  voltage?: number;
  rssi?: number;
};

function buildSeries(timestamps: Date[], readings: ReadingDoc[], key: keyof ReadingDoc): number[] {
  const out: number[] = [];
  // readings are expected sorted asc
  let j = 0;
  let lastVal: any = undefined;
  for (const t of timestamps) {
    const tm = t.getTime();
    while (j < readings.length && readings[j].ts.getTime() <= tm) {
      const v = (readings[j] as any)[key];
      if (typeof v === "number" && Number.isFinite(v)) lastVal = v;
      j++;
    }
    if (typeof lastVal === "number" && Number.isFinite(lastVal)) out.push(lastVal);
    else out.push(NaN);
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

    const projectId = searchParams.get("projectId");
    const db = await getDb();
    const query: any = projectId ? { projectId } : {};

    // Build requested timeline
    const timestampStrings = generateTimestamps(start, end, resolution);
    const timeline = timestampStrings.map((t) => new Date(t));

    // Find sensors in scope
    const sensors = await db.collection("iot_sensors").find(query, { projection: { _id: 1 } }).toArray();
    const sensorIds = sensors.map((s: any) => String(s._id));

    const data: Record<string, Record<string, number[]>> = {};
    if (sensorIds.length === 0) {
      return NextResponse.json({ timestamps: timestampStrings, data }, { status: 200 });
    }

    const readingQuery: any = {
      sensorId: { $in: sensorIds },
      ts: { $gte: start, $lte: end },
    };
    if (projectId) readingQuery.projectId = projectId;

    const readings = (await db
      .collection("iot_sensor_readings")
      .find(readingQuery)
      .sort({ ts: 1 })
      .toArray()) as unknown as ReadingDoc[];

    const bySensor = new Map<string, ReadingDoc[]>();
    for (const r of readings) {
      const sid = String((r as any).sensorId);
      const arr = bySensor.get(sid) || [];
      // Ensure ts is Date
      (r as any).ts = (r as any).ts instanceof Date ? (r as any).ts : new Date((r as any).ts);
      arr.push(r);
      bySensor.set(sid, arr);
    }

    for (const [sid, arr] of bySensor.entries()) {
      if (!arr.length) continue;
      const rec: Record<string, number[]> = {};

      // Standard channels used in existing dashboards
      rec.temp = buildSeries(timeline, arr, "temp");
      rec.rh = buildSeries(timeline, arr, "rh");
      rec.co2 = buildSeries(timeline, arr, "co2");
      rec.pressure = buildSeries(timeline, arr, "pressure");

      // Seismic dashboard channels
      rec.magnitude = buildSeries(timeline, arr, "magnitude");
      rec.acceleration = buildSeries(timeline, arr, "acceleration");
      rec.frequency = buildSeries(timeline, arr, "frequency");
      rec.displacement = buildSeries(timeline, arr, "displacement");

      // PV dashboard channel
      rec.production = buildSeries(timeline, arr, "production");

      // Ubibot extra fields (if needed later)
      rec.light = buildSeries(timeline, arr, "light");
      rec.voltage = buildSeries(timeline, arr, "voltage");
      rec.rssi = buildSeries(timeline, arr, "rssi");

      // If every series is NaN-only, skip (no real history in range)
      const hasAny = Object.values(rec).some((series) => series.some((v) => Number.isFinite(v)));
      if (!hasAny) continue;

      data[sid] = rec;
    }

    return NextResponse.json({ timestamps: timestampStrings, data }, { status: 200 });
  } catch (error) {
    console.error("/api/iot/samples failed:", error);
    return NextResponse.json({ message: "Failed to load samples" }, { status: 500 });
  }
}
