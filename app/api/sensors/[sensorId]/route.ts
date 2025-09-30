import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

// Helper functions for dynamic value generation (copied from IoT sensors API)
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
    val += walk; val += (baseline - val) * 0.12;
    if (spikeLeft <= 0 && rnd() < 0.04) { spikeLeft = 2 + Math.floor(rnd() * 4); const up = rnd() < 0.7; spikeAmp = (up ? 4 : -3) + (rnd() * (up ? 6 : 3)); }
    if (spikeLeft > 0) { const factor = spikeLeft / (spikeLeft + 2); val += spikeAmp * factor * 0.6; spikeLeft--; }
    out.push(parseFloat(clamp(val).toFixed(1)));
  }
  return out;
}

function currentTempForGroup(groupKey: string, at: Date): number {
  const rnd = seededRandom(groupKey);
  const count = 96;
  const start = new Date(at); start.setHours(0,0,0,0);
  const end = new Date(start); end.setHours(23,59,59,999);
  const series = generateTempSeries(count, rnd);
  const frac = Math.min(1, Math.max(0, (at.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
  const idx = Math.min(count - 1, Math.max(0, Math.floor(frac * (count - 1))));
  return series[idx];
}

function currentHumidityForGroup(groupKey: string, at: Date): number {
  const rnd = seededRandom(groupKey + "-hum");
  const count = 96;
  const start = new Date(at); start.setHours(0,0,0,0);
  const end = new Date(start); end.setHours(23,59,59,999);
  const phase = (at.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  const wave = Math.cos(Math.PI * 2 * phase) * 6;
  const base = 48 + wave;
  const jitter = (rnd() - 0.5) * 8;
  const val = Math.max(25, Math.min(80, base + jitter));
  return Math.round(val);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sensorId: string }> }
) {
  try {
    const { sensorId } = await params;

    if (!sensorId) {
      return NextResponse.json(
        { error: "Sensor ID is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const sensorsCollection = db.collection("iot_sensors");

    // Try to find the sensor by ObjectId first
    let sensor;
    try {
      sensor = await sensorsCollection.findOne({ _id: new ObjectId(sensorId) });
    } catch (error) {
      // If ObjectId parsing fails, try finding by string ID
      sensor = await sensorsCollection.findOne({ id: sensorId });
    }

    if (!sensor) {
      return NextResponse.json(
        { error: "Sensor not found" },
        { status: 404 }
      );
    }

    // Transform the sensor data to match the expected format with dynamic values
    const now = new Date();
    const groupKey = sensor.externalId || sensor.devsn || String(sensor._id);
    let valueStr: string = sensor.value;
    
    // Generate dynamic values based on sensor type (matching the IoT sensors API logic)
    const t = (sensor.type || '').toLowerCase();
    if (t.includes('temperature')) {
      const v = currentTempForGroup(String(groupKey), now);
      valueStr = `${v.toFixed(1)}°C`;
    } else if (t.includes('humidity')) {
      const v = currentHumidityForGroup(String(groupKey), now);
      valueStr = `${Math.round(v)}%`;
    }
    
    const sensorData = {
      id: sensor._id.toString(),
      name: sensor.name,
      type: sensor.type,
      status: sensor.status || "Online",
      value: valueStr,
      position: sensor.position,
      batteryLevel: sensor.batteryLevel || 100,
      lastUpdate: sensor.lastUpdate || new Date().toISOString(),
      room: sensor.room || "Unknown Room",
      roomId: sensor.roomId,
      roomData: sensor.roomData,
      color: sensor.color,
      projectId: sensor.projectId,
      modelPosition: sensor.modelPosition || sensor.position,
      code: sensor.code,
      mark: sensor.mark,
      model: sensor.model,
      link: sensor.link
    };

    return NextResponse.json(sensorData);
  } catch (error) {
    console.error("Error fetching sensor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}