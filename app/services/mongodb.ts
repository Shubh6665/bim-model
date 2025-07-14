import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB || "bim-client";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) {
    console.log("[MongoDB] Reusing existing database connection.");
    return db;
  }
  if (!client) {
    try {
      client = new MongoClient(uri);
      await client.connect();
      console.log("[MongoDB] Connected to database.");
    } catch (err) {
      console.error("[MongoDB] Connection error:", err);
      throw err;
    }
  } else {
    console.log("[MongoDB] Reusing existing client connection.");
  }
  db = client.db(dbName);
  return db;
} 