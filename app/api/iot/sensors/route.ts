import { NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const sensors = await db.collection('iot_sensors').find({}).toArray();
    return NextResponse.json(sensors, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch sensors:', error);
    return NextResponse.json({ message: 'Failed to fetch sensors' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { sensorType, position, hostDbId } = await request.json();

    if (!sensorType || !position || hostDbId === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    
    const db = await getDb();
    const newSensor = {
      sensorId: `sensor_${Date.now()}`,
      sensorType,
      position,
      hostDbId,
      createdAt: new Date(),
    };

    const result = await db.collection('iot_sensors').insertOne(newSensor);
    return NextResponse.json({ ...newSensor, _id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create sensor:', error);
    return NextResponse.json({ message: 'Failed to create sensor' }, { status: 500 });
  }
}
