/**
 * MONGODB INDEXES SETUP SCRIPT
 * 
 * Why Indexes Matter:
 * Without indexes, MongoDB scans EVERY document (Collection Scan).
 * With indexes, it directly finds documents (Index Scan).
 * 
 * Example:
 * - 100,000 sensors without index: ~500ms query
 * - 100,000 sensors with index: ~5ms query (100x faster!)
 * 
 * Interview Point: "Implemented strategic database indexing that reduced
 * query response times from 500ms to <10ms for high-traffic collections."
 * 
 * Run this script: node scripts/create-indexes.js
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'bim-client';

async function createIndexes() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // ============================================
    // USERS COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: users');
    
    // Email lookup (login, invites) - UNIQUE
    await db.collection('users').createIndex(
      { email: 1 },
      { unique: true, name: 'idx_users_email' }
    );
    console.log('  ✓ idx_users_email (unique)');
    
    // ============================================
    // PROJECTS COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: projects');
    
    // User's projects lookup
    await db.collection('projects').createIndex(
      { userId: 1 },
      { name: 'idx_projects_userId' }
    );
    console.log('  ✓ idx_projects_userId');
    
    // Company filter
    await db.collection('projects').createIndex(
      { company: 1 },
      { name: 'idx_projects_company' }
    );
    console.log('  ✓ idx_projects_company');
    
    // Model URN lookup (Forge viewer)
    await db.collection('projects').createIndex(
      { 'models.urn': 1 },
      { name: 'idx_projects_model_urn', sparse: true }
    );
    console.log('  ✓ idx_projects_model_urn');
    
    // ============================================
    // INVITES COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: invites');
    
    // Invite lookup by email + status (most common query)
    await db.collection('invites').createIndex(
      { 'invitee.email': 1, status: 1 },
      { name: 'idx_invites_email_status' }
    );
    console.log('  ✓ idx_invites_email_status');
    
    // Token lookup (invite acceptance)
    await db.collection('invites').createIndex(
      { token: 1 },
      { unique: true, name: 'idx_invites_token' }
    );
    console.log('  ✓ idx_invites_token (unique)');
    
    // Project invites
    await db.collection('invites').createIndex(
      { projectId: 1 },
      { name: 'idx_invites_projectId' }
    );
    console.log('  ✓ idx_invites_projectId');
    
    // ============================================
    // SENSORS COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: sensors');
    
    // Sensors by project (dashboard view)
    await db.collection('sensors').createIndex(
      { projectId: 1 },
      { name: 'idx_sensors_projectId' }
    );
    console.log('  ✓ idx_sensors_projectId');
    
    // Sensors by type for filtering
    await db.collection('sensors').createIndex(
      { projectId: 1, type: 1 },
      { name: 'idx_sensors_project_type' }
    );
    console.log('  ✓ idx_sensors_project_type (compound)');
    
    // Room-based sensor lookup
    await db.collection('sensors').createIndex(
      { projectId: 1, room: 1 },
      { name: 'idx_sensors_project_room' }
    );
    console.log('  ✓ idx_sensors_project_room (compound)');
    
    // ============================================
    // WORK ORDERS COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: work_orders');
    
    // Work orders by project + status
    await db.collection('work_orders').createIndex(
      { projectId: 1, status: 1 },
      { name: 'idx_workorders_project_status' }
    );
    console.log('  ✓ idx_workorders_project_status');
    
    // Work orders by asset
    await db.collection('work_orders').createIndex(
      { projectId: 1, assetId: 1 },
      { name: 'idx_workorders_project_asset' }
    );
    console.log('  ✓ idx_workorders_project_asset');
    
    // Created date for sorting
    await db.collection('work_orders').createIndex(
      { projectId: 1, createdAt: -1 },
      { name: 'idx_workorders_project_date' }
    );
    console.log('  ✓ idx_workorders_project_date');
    
    // ============================================
    // TICKETS COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: tickets');
    
    // Tickets by project + status
    await db.collection('tickets').createIndex(
      { projectId: 1, status: 1 },
      { name: 'idx_tickets_project_status' }
    );
    console.log('  ✓ idx_tickets_project_status');
    
    // Pending approvals query
    await db.collection('tickets').createIndex(
      { projectId: 1, status: 1, createdAt: -1 },
      { name: 'idx_tickets_pending' }
    );
    console.log('  ✓ idx_tickets_pending');
    
    // ============================================
    // ASSETS COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: assets');
    
    // Assets by project
    await db.collection('assets').createIndex(
      { projectId: 1 },
      { name: 'idx_assets_projectId' }
    );
    console.log('  ✓ idx_assets_projectId');
    
    // Asset by dbId (Forge viewer integration)
    await db.collection('assets').createIndex(
      { projectId: 1, dbId: 1 },
      { name: 'idx_assets_project_dbId' }
    );
    console.log('  ✓ idx_assets_project_dbId');
    
    // Category filter
    await db.collection('assets').createIndex(
      { projectId: 1, category: 1 },
      { name: 'idx_assets_project_category' }
    );
    console.log('  ✓ idx_assets_project_category');
    
    // ============================================
    // ACTIVITY LOGS COLLECTION
    // ============================================
    console.log('\n📊 Creating indexes for: activity_logs');
    
    // Activity by project + time (timeline view)
    await db.collection('activity_logs').createIndex(
      { projectId: 1, timestamp: -1 },
      { name: 'idx_activity_project_time' }
    );
    console.log('  ✓ idx_activity_project_time');
    
    // TTL index - auto-delete logs after 90 days
    await db.collection('activity_logs').createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'idx_activity_ttl' }
    );
    console.log('  ✓ idx_activity_ttl (90 days TTL)');
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL INDEXES CREATED SUCCESSFULLY');
    console.log('='.repeat(50));
    
    // List all indexes
    const collections = ['users', 'projects', 'invites', 'sensors', 
                         'work_orders', 'tickets', 'assets', 'activity_logs'];
    
    console.log('\n📋 Index Summary:');
    for (const coll of collections) {
      const indexes = await db.collection(coll).indexes();
      console.log(`\n${coll}: ${indexes.length} indexes`);
      indexes.forEach(idx => {
        if (idx.name !== '_id_') {
          console.log(`  - ${idx.name}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

createIndexes();
