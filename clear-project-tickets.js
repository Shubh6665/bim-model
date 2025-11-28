// Load from .env.local instead of default .env
require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'bim-client';

if (!uri) {
  console.error('Missing MONGODB_URI in environment');
  process.exit(1);
}
// Hard-coded projectId to clear
const PROJECT_ID = '68cf91fb8c4e8a0c8627ddca';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const ticketsCol = db.collection('fm_tickets');
    const workOrdersCol = db.collection('fm_work_orders');

    console.log(`Deleting tickets for projectId=${PROJECT_ID} ...`);
    const ticketResult = await ticketsCol.deleteMany({ projectId: PROJECT_ID });
    console.log(`Deleted ${ticketResult.deletedCount} ticket(s) from fm_tickets.`);

    console.log(`Deleting work orders for projectId=${PROJECT_ID} ...`);
    const workOrderResult = await workOrdersCol.deleteMany({ projectId: PROJECT_ID });
    console.log(`Deleted ${workOrderResult.deletedCount} work order(s) from fm_work_orders.`);
  } catch (err) {
    console.error('Error while deleting tickets:', err);
  } finally {
    await client.close();
  }
}

run();
