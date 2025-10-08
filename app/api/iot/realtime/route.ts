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
      // Generate daily production data (kWh) as per client specification
      // Client requires: Daily production data only, not instantaneous power/voltage/current
      const hour = timestamp.getHours();
      const minute = timestamp.getMinutes();
      const timeInHours = hour + minute / 60;
      
      console.log(`[IoT Realtime API] FV Sensor time check: hour=${hour}, minute=${minute}, timeInHours=${timeInHours}`);
      
      // Generate cumulative daily production (kWh) based on time of day
      // Typical solar panel generates 15-40 kWh per day
      // Production accumulates throughout the day (5 AM - 7 PM)
      if (timeInHours >= 5 && timeInHours <= 19) {
        // Calculate progress through the day (0 to 1)
        const dayProgress = (timeInHours - 5) / 14; // 0 at 5 AM, 1 at 7 PM
        
        // Total daily capacity: 25-35 kWh (realistic for residential solar)
        const dailyCapacity = 28 + (Math.random() - 0.5) * 6;
        
        // Use sigmoid curve for cumulative production (slow start, rapid midday, slow end)
        const cumulativeProduction = dailyCapacity * (1 / (1 + Math.exp(-8 * (dayProgress - 0.5))));
        
        console.log(`[IoT Realtime API] FV Daily Production: ${cumulativeProduction.toFixed(2)} kWh (${(dayProgress * 100).toFixed(1)}% through day)`);
        
        // Return only daily production in kWh as per client spec
        return { 
          value: `${cumulativeProduction.toFixed(2)} kWh`, 
          status 
        };
      } else {
        // At night, production is 0 kWh
        console.log(`[IoT Realtime API] FV Night mode - no generation`);
        return { value: `0.00 kWh`, status };
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
