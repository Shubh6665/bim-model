import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-config";
import { getShellyDeviceStatus } from "@/app/services/shelly";

/**
 * POST /api/iot/shelly/validate
 * Validates Shelly device connection and returns current status
 * Used when adding a new Shelly sensor to verify the device is reachable
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, authKey, serverUri } = body;

    if (!deviceId) {
      return NextResponse.json(
        { success: false, message: "Device ID is required" },
        { status: 400 }
      );
    }

    // Use provided auth key or fallback to environment variable
    const finalAuthKey = authKey?.trim() || process.env.SHELLY_AUTH_KEY || "";
    const finalServerUri = serverUri?.trim() || process.env.SHELLY_CLOUD_SERVER || "https://shelly-238-eu.shelly.cloud";

    if (!finalAuthKey) {
      return NextResponse.json(
        { success: false, message: "Auth key is required (either provide one or set SHELLY_AUTH_KEY env variable)" },
        { status: 400 }
      );
    }

    console.log(`[Shelly Validate] Testing connection for device: ${deviceId}`);

    const data = await getShellyDeviceStatus(deviceId.trim(), finalAuthKey, finalServerUri);

    if (!data) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Could not connect to Shelly device. Please verify the Device ID and Authorization Key.",
          deviceId,
          serverUri: finalServerUri
        },
        { status: 400 }
      );
    }

    // Return success with device data
    return NextResponse.json({
      success: true,
      message: "Device connected successfully",
      deviceId,
      serverUri: finalServerUri,
      data: {
        temperature: data.temperature,
        humidity: data.humidity,
        battery: data.battery,
        online: data.online,
        timestamp: data.timestamp,
      }
    });
  } catch (error: any) {
    console.error("[Shelly Validate] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error?.message || "Failed to validate Shelly device",
        error: String(error)
      },
      { status: 500 }
    );
  }
}
