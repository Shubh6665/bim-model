/**
 * Script to pre-seed sensors for testing IoT functionality
 * Run with: node scripts/seed-sensors.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://weekendsync:FqTnvl6KzUhMwYIU@weekendsync.9hrxv2m.mongodb.net';
const DB_NAME = process.env.MONGODB_DB || 'bim-client';

const sampleSensors = [
  {
    name: "Temperature Sensor 01",
    type: "Temperature",
    status: "Online",
    value: "22.5",
    position: { x: 10, y: 5, z: 3 },
    batteryLevel: 85,
    lastUpdate: new Date().toISOString(),
    room: "Conference Room A",
    color: "#ef4444",
    projectId: null,
    modelPosition: { x: 10, y: 5, z: 3 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "CO2 Monitor 01",
    type: "CO2",
    status: "Online", 
    value: "420",
    position: { x: -15, y: 8, z: 2 },
    batteryLevel: 92,
    lastUpdate: new Date().toISOString(),
    room: "Office Space B",
    color: "#22c55e",
    projectId: null,
    modelPosition: { x: -15, y: 8, z: 2 },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

async function seedSensors() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DB_NAME);
    const collection = db.collection('iot_sensors');
    
    // Clear existing sensors
    console.log('Clearing existing sensors...');
    await collection.deleteMany({});
    
    // Insert sample sensors
    console.log('Inserting sample sensors...');
    const result = await collection.insertMany(sampleSensors);
    
    console.log(`Successfully inserted ${result.insertedCount} sensors:`);
    sampleSensors.forEach((sensor, index) => {
      console.log(`  ${index + 1}. ${sensor.name} (${sensor.type}) - ${sensor.room}`);
    });
    
  } catch (error) {
    console.error('Error seeding sensors:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed.');
    }
  }
}

// Run the seeding function
if (require.main === module) {
  seedSensors();
}

module.exports = { seedSensors, sampleSensors };
