import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";

// Utility to parse date params safely
function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

// Generate temperature with day-night trend and occasional spikes
function generateTempSeries(count: number, rnd: () => number, dateOffset: number = 0): number[] {
  const out: number[] = [];
  // Vary initial temp and baseline based on date offset for different daily patterns
  const dayVariation = Math.sin(dateOffset * 0.3) * 3; // ±3°C variation between days
  let val = 24 + dayVariation + (rnd() - 0.5) * 4; // initial temp varies by day
  let spikeLeft = 0;
  let spikeAmp = 0;
  const clamp = (x: number) => Math.max(18, Math.min(42, x));
  
  for (let i = 0; i < count; i++) {
    // Diurnal baseline: cooler at edges, warmer in middle of range
    const phase = count > 1 ? i / (count - 1) : 0.5; // 0..1 across the day window
    const wave = Math.sin(Math.PI * phase); // 0..1..0
    const baseline = 22 + dayVariation + 10 * wave; // 22 at night → ~32 midday, varies by day

    // Smooth random walk around baseline
    const walk = (rnd() - 0.5) * 1.2; // small short-term noise
    val += walk;
    val += (baseline - val) * 0.12; // pull towards baseline

    // Occasionally trigger a spike up or down
    if (spikeLeft <= 0 && rnd() < 0.04) {
      spikeLeft = 2 + Math.floor(rnd() * 4); // 2..5 samples
      const up = rnd() < 0.7; // mostly warm spikes
      spikeAmp = (up ? 4 : -3) + (rnd() * (up ? 6 : 3)); // +4..+10 or -3..0
    }
    if (spikeLeft > 0) {
      // tapering spike contribution
      const factor = spikeLeft / (spikeLeft + 2);
      val += spikeAmp * factor * 0.6;
      spikeLeft--;
    }

    val = clamp(val);
    out.push(parseFloat(val.toFixed(1)));
  }
  return out;
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

// Generate seismic magnitude series (Richter scale approximation)
function generateMagnitudeSeries(count: number, rnd: () => number, dateOffset: number = 0): number[] {
  const out: number[] = [];
  let baseLevel = 0.8 + Math.sin(dateOffset * 0.1) * 0.3; // Base magnitude varies by day
  let val = baseLevel;
  let eventInProgress = false;
  let eventDuration = 0;
  let eventPeakMagnitude = 0;
  
  for (let i = 0; i < count; i++) {
    // Check for seismic event trigger (5% chance)
    if (!eventInProgress && rnd() < 0.05) {
      eventInProgress = true;
      eventDuration = 3 + Math.floor(rnd() * 8); // 3-10 samples
      eventPeakMagnitude = 2.0 + rnd() * 3.0; // Magnitude 2.0-5.0
    }
    
    if (eventInProgress) {
      // Gradual rise to peak, then decay
      const progress = 1 - (eventDuration / 10);
      const bell = Math.exp(-Math.pow(progress - 0.5, 2) * 12); // Bell curve
      val = baseLevel + (eventPeakMagnitude - baseLevel) * bell;
      eventDuration--;
      if (eventDuration <= 0) eventInProgress = false;
    } else {
      // Background noise
      val = baseLevel + (rnd() - 0.5) * 0.2;
      val = Math.max(0.5, Math.min(1.5, val));
    }
    
    out.push(parseFloat(val.toFixed(2)));
  }
  return out;
}

// Generate acceleration series (m/s²)
function generateAccelerationSeries(count: number, rnd: () => number, dateOffset: number = 0): number[] {
  const out: number[] = [];
  let baseLevel = 0.001 + Math.sin(dateOffset * 0.15) * 0.0005; // Tiny background
  let val = baseLevel;
  let eventInProgress = false;
  let eventDuration = 0;
  let eventPeakAcceleration = 0;
  
  for (let i = 0; i < count; i++) {
    // Sync with magnitude events (5% chance)
    if (!eventInProgress && rnd() < 0.05) {
      eventInProgress = true;
      eventDuration = 3 + Math.floor(rnd() * 8);
      eventPeakAcceleration = 0.1 + rnd() * 0.9; // 0.1-1.0 m/s²
    }
    
    if (eventInProgress) {
      const progress = 1 - (eventDuration / 10);
      const bell = Math.exp(-Math.pow(progress - 0.5, 2) * 12);
      val = baseLevel + (eventPeakAcceleration - baseLevel) * bell;
      eventDuration--;
      if (eventDuration <= 0) eventInProgress = false;
    } else {
      // Background noise
      val = baseLevel + (rnd() - 0.5) * 0.0005;
      val = Math.max(0.0001, Math.min(0.005, val));
    }
    
    out.push(parseFloat(val.toFixed(4)));
  }
  return out;
}

// Generate frequency series (Hz)
function generateFrequencySeries(count: number, rnd: () => number, dateOffset: number = 0): number[] {
  const out: number[] = [];
  let baseFreq = 1.0 + Math.sin(dateOffset * 0.2) * 0.3; // Base frequency varies
  let val = baseFreq;
  let eventInProgress = false;
  let eventDuration = 0;
  let eventPeakFrequency = 0;
  
  for (let i = 0; i < count; i++) {
    // Sync with seismic events (5% chance)
    if (!eventInProgress && rnd() < 0.05) {
      eventInProgress = true;
      eventDuration = 3 + Math.floor(rnd() * 8);
      eventPeakFrequency = 5.0 + rnd() * 10.0; // 5-15 Hz during events
    }
    
    if (eventInProgress) {
      const progress = 1 - (eventDuration / 10);
      const bell = Math.exp(-Math.pow(progress - 0.5, 2) * 12);
      val = baseFreq + (eventPeakFrequency - baseFreq) * bell;
      eventDuration--;
      if (eventDuration <= 0) eventInProgress = false;
    } else {
      // Background variation
      val = baseFreq + (rnd() - 0.5) * 0.5;
      val = Math.max(0.5, Math.min(3.0, val));
    }
    
    out.push(parseFloat(val.toFixed(2)));
  }
  return out;
}

// Generate displacement series (mm)
function generateDisplacementSeries(count: number, rnd: () => number, dateOffset: number = 0): number[] {
  const out: number[] = [];
  let cumulative = 0;
  let baseLevel = 0.01;
  
  for (let i = 0; i < count; i++) {
    // Small random increments with occasional larger movements
    const increment = rnd() < 0.05 
      ? (rnd() * 0.5) // Event: 0-0.5mm
      : (rnd() * 0.01); // Normal: 0-0.01mm
    
    cumulative += increment;
    cumulative = Math.max(0, Math.min(5.0, cumulative)); // Cap at 5mm
    
    out.push(parseFloat(cumulative.toFixed(3)));
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
      // Include date in seed so different dates produce different data
      const dateStr = start.toISOString().split('T')[0]; // YYYY-MM-DD
      const seedId = groupKey + '-' + dateStr;
      const rnd = seededRandom(seedId);
      const count = timestamps.length;
      const type = (first?.type || "").toLowerCase();
      
      // Calculate days offset from epoch for day variation
      const epochStart = new Date('2025-01-01');
      const dayOffset = Math.floor((start.getTime() - epochStart.getTime()) / (24 * 60 * 60 * 1000));
      
      // Check if this is a seismic sensor
      const isSeismicSensor = type.includes("seismic") || type.includes("accelerometric");
      
      if (isSeismicSensor) {
        // Generate seismic-specific time series data
        const magnitude = generateMagnitudeSeries(count, rnd, dayOffset);
        const acceleration = generateAccelerationSeries(count, rnd, dayOffset);
        const frequency = generateFrequencySeries(count, rnd, dayOffset);
        const displacement = generateDisplacementSeries(count, rnd, dayOffset);
        
        for (const s of groupSensors) {
          const sensorId = String(s._id);
          data[sensorId] = { magnitude, acceleration, frequency, displacement };
          console.log(`[IoT Samples API] Assigned seismic series to sensor ${sensorId} (group: ${groupKey})`);
        }
      } else {
        // Generate standard sensor data (temp, humidity, etc.)
        const tempBase = type.includes("temp") ? 24.0 : 23.5;
        const rhBase = 48.0;
        const co2Base = 650;
        const pBase = 1012.0;
        // Use realistic temperature generator with date variation
        const temp = generateTempSeries(count, rnd, dayOffset);
        const rh = generateSeries(rhBase + Math.sin(dayOffset * 0.2) * 8, 4.0, count, rnd, false); // humidity varies by day too
        const co2 = generateSeries(co2Base, 60, count, rnd, true);
        const pressure = generateSeries(pBase, 2.0, count, rnd, false);
        // Assign the same merged series to all sensors in the group
        for (const s of groupSensors) {
          const sensorId = String(s._id);
          data[sensorId] = { temp, rh, co2, pressure };
          console.log(`[IoT Samples API] Assigned series to sensor ${sensorId} (group: ${groupKey})`);
        }
      }
    }

    return NextResponse.json({ timestamps, data }, { status: 200 });
  } catch (error) {
    console.error("/api/iot/samples failed:", error);
    return NextResponse.json({ message: "Failed to load samples" }, { status: 500 });
  }
}
