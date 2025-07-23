import { NextResponse } from "next/server";
import { getDb } from "@/app/services/mongodb";
import { ObjectId } from "mongodb";

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
  color?: string;
  projectId?: string;
  modelPosition?: { x: number; y: number; z: number };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const sensorType = searchParams.get("type");

    const db = await getDb();
    let query: any = {};

    if (projectId) {
      query.projectId = projectId;
    }

    if (sensorType) {
      query.type = sensorType;
    }

    const sensors = await db.collection("iot_sensors").find(query).toArray();

    // Transform MongoDB documents to our sensor format
    const transformedSensors = sensors.map((sensor) => ({
      id: sensor._id.toString(),
      name: sensor.name,
      type: sensor.type,
      status: sensor.status || "Online",
      value: sensor.value,
      position: sensor.position,
      batteryLevel: sensor.batteryLevel || 100,
      lastUpdate: sensor.lastUpdate || new Date().toISOString(),
      room: sensor.room || "Unknown Room",
      color: sensor.color,
      projectId: sensor.projectId,
      modelPosition: sensor.modelPosition || sensor.position,
    }));

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

    const db = await getDb();

    // Create sensor document
    const newSensor = {
      name: sensorData.name,
      type: sensorData.type,
      status: sensorData.status || "Online",
      value: sensorData.value || "0",
      position: sensorData.position,
      batteryLevel: sensorData.batteryLevel || 100,
      lastUpdate: new Date().toISOString(),
      room: sensorData.room || "Unknown Room",
      color: sensorData.color,
      projectId: sensorData.projectId,
      modelPosition: sensorData.modelPosition || sensorData.position,
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
    const { searchParams } = new URL(request.url);
    const sensorId = searchParams.get("id");

    if (!sensorId) {
      return NextResponse.json(
        { message: "Sensor ID is required" },
        { status: 400 },
      );
    }

    const db = await getDb();
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
