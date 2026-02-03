/**
 * Shelly Cloud API Service
 * Documentation: https://shelly-api-docs.shelly.cloud/gen2/Devices/Gen3/ShellyHTG3/
 */

const DEFAULT_SHELLY_CLOUD_API = "https://shelly-238-eu.shelly.cloud";

export interface ShellySensorData {
  temperature?: number;
  humidity?: number;
  battery?: number;
  timestamp?: string;
  online?: boolean;
}

export interface ShellyDeviceStatus {
  isok: boolean;
  data?: {
    online?: boolean;
    device_status?: {
      "temperature:0"?: {
        tC?: number;
        tF?: number;
      };
      "humidity:0"?: {
        rh?: number;
      };
      "devicepower:0"?: {
        battery?: {
          V?: number;
          percent?: number;
        };
      };
      _updated?: string;
    };
  };
  errors?: Record<string, string>;
}

/**
 * Fetch device status from Shelly Cloud API
 * @param deviceId - Shelly device ID (e.g., "80b54e33e164")
 * @param authKey - Authorization Cloud Key from Shelly Cloud
 * @returns Device status with temperature, humidity, and battery data
 */
export async function getShellyDeviceStatus(
  deviceId: string,
  authKey: string,
  cloudBaseUrl: string = DEFAULT_SHELLY_CLOUD_API
): Promise<ShellySensorData | null> {
  try {
    const params = new URLSearchParams();
    params.append("id", deviceId);
    params.append("auth_key", authKey);

    const targetUrl = `${cloudBaseUrl.replace(/\/+$/, "")}/device/status`;
    console.log(`[Shelly] Fetching status from: ${targetUrl} for device: ${deviceId}`);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
        console.error(`[Shelly] HTTP Error: ${response.status} ${response.statusText}`);
        return null; // Return null on HTTP error
    }

    const result: ShellyDeviceStatus = await response.json();

    if (!result.isok || !result.data?.device_status) {
      console.error("Shelly API error:", result.errors || JSON.stringify(result));
      return null;
    }

    const deviceStatus = result.data.device_status;
    
    return {
      temperature: deviceStatus["temperature:0"]?.tC,
      humidity: deviceStatus["humidity:0"]?.rh,
      battery: deviceStatus["devicepower:0"]?.battery?.percent,
      timestamp: deviceStatus._updated || new Date().toISOString(),
      online: result.data.online ?? true,
    };
  } catch (error) {
    console.error("Error fetching Shelly device status:", error);
    return null;
  }
}

/**
 * Fetch device status from local IP (fallback when cloud is unavailable)
 * @param ipAddress - Local IP address of the device (e.g., "192.168.1.14")
 * @returns Device status with temperature and humidity data
 */
export async function getShellyLocalStatus(
  ipAddress: string
): Promise<ShellySensorData | null> {
  try {
    // Gen2/Gen3 local RPC is typically POST http://<ip>/rpc with JSON body.
    const response = await fetch(`http://${ipAddress}/rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: 1, method: "Shelly.GetStatus" }),
    });

    const payload = await response.json();
    const result = payload?.result ?? payload;

    return {
      temperature: result?.["temperature:0"]?.tC,
      humidity: result?.["humidity:0"]?.rh,
      battery: result?.["devicepower:0"]?.battery?.percent,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching local Shelly device status:", error);
    return null;
  }
}

/**
 * Build a sensor snapshot for database storage (similar to UbiBot format)
 */
export function buildShellySensorSnapshot(
  sensorData: ShellySensorData,
  sensorId: string,
  sensorName: string
) {
  return {
    sensorId,
    sensorName,
    provider: "shelly",
    timestamp: sensorData.timestamp || new Date().toISOString(),
    temperature: sensorData.temperature,
    humidity: sensorData.humidity,
    battery: sensorData.battery,
    rawData: sensorData,
  };
}
