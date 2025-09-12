import { NextResponse } from "next/server";

// Static channel metadata similar to APS IoT demo
// Keep IDs short and stable; expose human-friendly names and units
const CHANNELS = {
  temp: { id: "temp", name: "Temperature", unit: "\u00B0C" },
  rh: { id: "rh", name: "Relative humidity", unit: "%RH" },
  co2: { id: "co2", name: "CO2", unit: "ppm" },
  pressure: { id: "pressure", name: "Barometric pressure", unit: "hPa" },
} as const;

export async function GET() {
  try {
    return NextResponse.json(CHANNELS, { status: 200 });
  } catch (error) {
    console.error("/api/iot/channels failed:", error);
    return NextResponse.json({ message: "Failed to load channels" }, { status: 500 });
  }
}
