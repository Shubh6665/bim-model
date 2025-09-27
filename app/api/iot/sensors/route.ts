import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-config";
import { isPlatformOwnerEmail, isApprovedAdministratorForCompany } from "@/app/lib/rbac";

interface SensorData {
  id?: string;
  name: string;
  type: string;
  status: "Online" | "Offline" | "Warning";
  value: string;
  position: { x: number; y: number; z: number };
  batteryLevel: number;
  lastUpdate: string;
  room: string;
  roomId?: number;
  roomData?: any;
  color?: string;
  projectId?: string;
  modelPosition?: { x: number; y: number; z: number };
  // Additional fields for detailed sensor information
  code?: string;
  mark?: string;
  model?: string;
  link?: string;
}

// ---------- Helpers to align displayed values with /api/iot/samples and /api/iot/realtime ----------
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
  // Simple smooth series around 48±12 with mild day swing
  const count = 96;
  const start = new Date(at); start.setHours(0,0,0,0);
  const end = new Date(start); end.setHours(23,59,59,999);
  const phase = (at.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  const wave = Math.cos(Math.PI * 2 * phase) * 6; // mild daily swing
  const base = 48 + wave;
  // jitter via seeded rnd
  const jitter = (rnd() - 0.5) * 8;
  const val = Math.max(25, Math.min(80, base + jitter));
  return Math.round(val);
}

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

async function hasProjectAccess(projectId: string, requiredPackage: 'IoT', userEmail: string) {
  const db = await getDb();
  
  // Platform owner check - platform owners have access to everything
  if (isPlatformOwnerEmail(userEmail)) return true;
  
  // Get user
  const user = await db.collection('users').findOne({ email: userEmail });
  if (!user) return false;
  
  // Get project to check admin access
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!project) return false;
  
  // Administrator check (no company matching required)
  if (Array.isArray(user.adminCompanies) && user.adminCompanies.some((entry: any) => entry.status === 'approved')) return true;
  
  // Owner check
  const ownerProject = await db.collection('projects').findOne({ _id: new ObjectId(projectId), userId: user._id });
  if (ownerProject) return true;
  
  // Invited with package check
  const invite = await db.collection('invites').findOne({
    projectId: new ObjectId(projectId),
    'invitee.email': userEmail,
    status: 'accepted',
    // packages is an array; use $in to check membership
    'invitee.packages': { $in: [requiredPackage] },
  });
  return !!invite;
}

export async function GET(request: Request) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const sensorType = searchParams.get("type");
    if (!projectId) {
      return NextResponse.json({ message: 'projectId is required' }, { status: 400 });
    }
    const allowed = await hasProjectAccess(projectId, 'IoT', email);
    if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    const db = await getDb();
    let query: any = {};

    query.projectId = projectId;

    if (sensorType) {
      query.type = sensorType;
    }

    const sensors = await db.collection("iot_sensors").find(query).toArray();

    // Transform MongoDB documents to our sensor format
    const now = new Date();
    const transformedSensors = sensors.map((sensor) => {
      const groupKey = sensor.externalId || sensor.devsn || String(sensor._id);
      let valueStr: string = sensor.value;
      const t = (sensor.type || '').toLowerCase();
      if (t.includes('temperature')) {
        const v = currentTempForGroup(String(groupKey), now);
        valueStr = `${v.toFixed(1)}°C`;
      } else if (t.includes('humidity')) {
        const v = currentHumidityForGroup(String(groupKey), now);
        valueStr = `${Math.round(v)}%`;
      }
      return {
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
        // Additional fields
        code: sensor.code,
        mark: sensor.mark,
        model: sensor.model,
        link: sensor.link,
      };
    });

    return NextResponse.json(transformedSensors, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch sensors:", error);
    return NextResponse.json(
      { message: "Failed to fetch sensors" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    const sensorData: SensorData = await request.json();

    // Validate required fields
    if (!sensorData.name || !sensorData.type || !sensorData.position) {
      return NextResponse.json(
        {
          message:
            "Missing required fields: name, type, and position are required",
        },
        { status: 400 },
      );
    }

    // Require projectId and verify IoT access for this project
    if (!sensorData.projectId) {
      return NextResponse.json({ message: 'projectId is required' }, { status: 400 });
    }
    const allowedPost = await hasProjectAccess(sensorData.projectId, 'IoT', email);
    if (!allowedPost) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const db = await getDb();

    // Create sensor document
    const groupKey = (sensorData as any).externalId || (sensorData as any).devsn || sensorData.name || String(Date.now());
    // compute initial aligned value
    let initialValue = sensorData.value || "0";
    const typeLower = (sensorData.type || '').toLowerCase();
    if (typeLower.includes('temperature')) {
      const v = currentTempForGroup(String(groupKey), new Date());
      initialValue = `${v.toFixed(1)}°C`;
    } else if (typeLower.includes('humidity')) {
      const v = currentHumidityForGroup(String(groupKey), new Date());
      initialValue = `${Math.round(v)}%`;
    }

    const newSensor = {
      name: sensorData.name,
      type: sensorData.type,
      status: sensorData.status || "Online",
      value: initialValue,
      position: sensorData.position,
      batteryLevel: sensorData.batteryLevel || 100,
      lastUpdate: new Date().toISOString(),
      room: sensorData.room || "Unknown Room",
      roomId: sensorData.roomId,
      roomData: sensorData.roomData,
      color: sensorData.color,
      projectId: sensorData.projectId,
      modelPosition: sensorData.modelPosition || sensorData.position,
      // Additional fields
      code: sensorData.code,
      mark: sensorData.mark,
      model: sensorData.model,
      link: sensorData.link,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("iot_sensors").insertOne(newSensor);

    // Return the created sensor with ID
    const createdSensor = {
      id: result.insertedId.toString(),
      ...newSensor,
      lastUpdate: newSensor.lastUpdate,
    };

    return NextResponse.json(createdSensor, { status: 201 });
  } catch (error) {
    console.error("Failed to create sensor:", error);
    return NextResponse.json(
      { message: "Failed to create sensor" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const sensorId = searchParams.get("id");

    if (!sensorId) {
      return NextResponse.json(
        { message: "Sensor ID is required" },
        { status: 400 },
      );
    }

    const updates = await request.json();
    const db = await getDb();

    // find sensor to determine projectId for access check
    const existing = await db.collection('iot_sensors').findOne({ _id: new ObjectId(sensorId) });
    if (!existing) {
      return NextResponse.json({ message: 'Sensor not found' }, { status: 404 });
    }
    const allowed = await hasProjectAccess(String(existing.projectId), 'IoT', email);
    if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // Remove id from updates to avoid conflicts
    const { id, ...updateData } = updates;

    // Add timestamp
    updateData.updatedAt = new Date();
    updateData.lastUpdate = new Date().toISOString();

    const result = await db
      .collection("iot_sensors")
      .updateOne({ _id: new ObjectId(sensorId) }, { $set: updateData });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Sensor not found" },
        { status: 404 },
      );
    }

    // Fetch and return updated sensor
    const updatedSensor = await db
      .collection("iot_sensors")
      .findOne({ _id: new ObjectId(sensorId) });

    if (updatedSensor) {
      const transformedSensor = {
        id: updatedSensor._id.toString(),
        name: updatedSensor.name,
        type: updatedSensor.type,
        status: updatedSensor.status,
        value: updatedSensor.value,
        position: updatedSensor.position,
        batteryLevel: updatedSensor.batteryLevel,
        lastUpdate: updatedSensor.lastUpdate,
        room: updatedSensor.room,
        roomId: updatedSensor.roomId,
        roomData: updatedSensor.roomData,
        color: updatedSensor.color,
        projectId: updatedSensor.projectId,
        modelPosition: updatedSensor.modelPosition,
      };

      return NextResponse.json(transformedSensor, { status: 200 });
    }

    return NextResponse.json(
      { message: "Failed to retrieve updated sensor" },
      { status: 500 },
    );
  } catch (error) {
    console.error("Failed to update sensor:", error);
    return NextResponse.json(
      { message: "Failed to update sensor" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const sensorId = searchParams.get("id");

    if (!sensorId) {
      return NextResponse.json(
        { message: "Sensor ID is required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const existing = await db.collection('iot_sensors').findOne({ _id: new ObjectId(sensorId) });
    if (!existing) {
      return NextResponse.json({ message: 'Sensor not found' }, { status: 404 });
    }
    const allowed = await hasProjectAccess(String(existing.projectId), 'IoT', email);
    if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const result = await db
      .collection("iot_sensors")
      .deleteOne({ _id: new ObjectId(sensorId) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { message: "Sensor not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: "Sensor deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to delete sensor:", error);
    return NextResponse.json(
      { message: "Failed to delete sensor" },
      { status: 500 },
    );
  }
}
