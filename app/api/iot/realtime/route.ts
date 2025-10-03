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
  // Add random variation to base value
  const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
  let currentVal = baseValue * (1 + variation);
  let status: "Online" | "Warning" | "Offline" = "Online";

  switch (sensorType.toLowerCase()) {
    case "temperature":
      currentVal = Math.max(18, Math.min(42, currentVal));
      status = currentVal >= 35 ? "Warning" : "Online";
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
    
    case "photovoltaic":
    case "fv sensor":
    case "pv sensor":
      // Generate realistic solar panel data based on time of day
      // Use local time (assuming IST/UTC+5:30 for India, or local timezone)
      const hour = timestamp.getHours();
      const minute = timestamp.getMinutes();
      const timeInHours = hour + minute / 60;
      
      console.log(`[IoT Realtime API] FV Sensor time check: hour=${hour}, minute=${minute}, timeInHours=${timeInHours}`);
      
      // Solar generation during extended daylight (5 AM - 7 PM for better demo)
      // In production, this should use actual sunrise/sunset times
      if (timeInHours >= 5 && timeInHours <= 19) {
        // Map time to solar position (0 to 1, peak at noon)
        const solarPosition = (timeInHours - 5) / 14; // 0 to 1 over 5 AM to 7 PM
        const peakTime = 0.5; // Noon is at 50% of the range
        const distanceFromPeak = Math.abs(solarPosition - peakTime);
        const bellCurve = Math.cos(distanceFromPeak * Math.PI); // Peak at noon
        
        // Power: 0-13 kW with solar curve + random variation
        const power = Math.max(0, bellCurve * 11 * (0.85 + Math.random() * 0.3));
        
        // Voltage: 280-360V when generating
        const voltage = power > 0.5 ? 320 + (Math.random() - 0.5) * 40 : 0;
        
        // Current: calculated from P = V × I
        const current = voltage > 0 ? (power * 1000) / voltage : 0;
        
        // Efficiency: 15-22%
        const efficiency = power > 0.5 ? 15 + bellCurve * 7 + (Math.random() - 0.5) * 2 : 0;
        
        console.log(`[IoT Realtime API] FV Generation: power=${power.toFixed(1)}kW, voltage=${voltage.toFixed(0)}V, current=${current.toFixed(1)}A, eff=${efficiency.toFixed(1)}%`);
        
        // Return combined string with all values
        return { 
          value: `${power.toFixed(1)} kW | ${voltage.toFixed(0)} V | ${current.toFixed(1)} A | ${efficiency.toFixed(1)}%`, 
          status 
        };
      } else {
        // No generation at night
        console.log(`[IoT Realtime API] FV Night mode - no generation`);
        return { value: `0.0 kW | 0 V | 0.0 A | 0.0%`, status };
      }
    
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

    // Process each sensor individually for unique values
    
    // Generate unique values for each sensor instead of grouping
    for (const sensor of sensors) {
      const type = sensor.type || "Temperature";
      const sensorId = String(sensor._id);
      const sensorName = sensor.name || "";
      
      console.log(`[IoT Realtime API] Processing sensor ${sensorId}: type="${type}", name="${sensorName}"`);
      
      // Check if this is FV/Photovoltaic sensor by type or name
      const isFVSensor = type.toLowerCase().includes("photovoltaic") || 
                        type.toLowerCase().includes("fv") || 
                        type.toLowerCase().includes("pv") ||
                        sensorName.toLowerCase().includes("fv") ||
                        sensorName.toLowerCase().includes("photovoltaic") ||
                        sensorName.toLowerCase().includes("pv sensor");
      
      // Base value from sensor type with random variation
      let baseValue = 23.5; // Default temperature
      
      if (isFVSensor) {
        // Special handling for FV sensors - use timestamp directly
        const { value, status } = generateCurrentValue("photovoltaic", 8.5, sensorId, now);
        updates.push({
          id: sensorId,
          value,
          status,
          lastUpdate: now.toISOString()
        });
        console.log(`[IoT Realtime API] Generated FV value for sensor ${sensor._id}: ${value} (${status})`);
        continue; // Skip to next sensor
      }
      
      switch (type.toLowerCase()) {
        case "temperature": 
          baseValue = 22 + Math.random() * 6; // 22-28°C range
          break;
        case "co2": 
          baseValue = 600 + Math.random() * 200; // 600-800 ppm range
          break;
        case "light": 
          baseValue = 400 + Math.random() * 300; // 400-700 lux range
          break;
        case "humidity": 
          baseValue = 40 + Math.random() * 20; // 40-60% range
          break;
        case "seismic and accelerometric": 
          baseValue = 0.01 + Math.random() * 0.03; // 0.01-0.04g range
          break;
        case "energy consumption": 
          baseValue = 1.8 + Math.random() * 1.4; // 1.8-3.2 kW range
          break;
        case "photovoltaic":
        case "fv sensor":
        case "pv sensor":
          baseValue = 8.5; // Will be calculated based on time in generateCurrentValue
          break;
        default:
          baseValue = baseValue + (Math.random() - 0.5) * 2; // ±1 variation
      }

      // Add time-based variation for more realistic fluctuation
      const timeVariation = Math.sin(Date.now() / 30000 + parseInt(sensorId.slice(-4), 16)) * 0.1;
      baseValue += baseValue * timeVariation;

      // Use individual sensor ID for unique randomness
      const { value, status } = generateCurrentValue(type, baseValue, sensorId, now);      updates.push({
        id: sensorId,
        value,
        status,
        lastUpdate: now.toISOString()
      });
      console.log(`[IoT Realtime API] Generated value for sensor ${sensor._id}: ${value} (${status})`);
    }

    return NextResponse.json({ updates, timestamp: now.toISOString() }, { status: 200 });
  } catch (error) {
    console.error("/api/iot/realtime failed:", error);
    return NextResponse.json({ message: "Failed to get realtime data" }, { status: 500 });
  }
}
