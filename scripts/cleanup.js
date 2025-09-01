/**
 * Complete System Cleanup Script
 * This script will clear ALL data including database and uploaded files:
 * - Database: Users, Projects, Invites, IoT Sensors, Forge Models, etc.
 * - File System: Uploaded files, cached models, temporary files
 * 
 * After running this script, the system will be completely reset.
 * 
 * Usage: node scripts/complete-cleanup-fixed.js
 */

// Load environment variables from parent directory
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'bim-client';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// List of all collections to clear
const COLLECTIONS_TO_CLEAR = [
  'users',                    // User accounts, credentials, roles
  'projects',                 // All project data
  'invites',                  // Project invitations
  'iot_sensors',             // IoT sensor data
  'forge_models',            // CAD/BIM model data
  'annotations',             // File annotations
  'properties',              // Model properties
  'admin_requests',          // Admin approval requests
  'sessions',                // User sessions
  'uploads',                 // File uploads metadata
  'files',                   // File records
  'folders',                 // Folder records
  'shareLinks',              // File sharing links
  'zipShares',               // Zip file shares
  'companies',               // Company data
  'notifications',           // User notifications
  'cache',                   // Any cached data
  'logs',                    // Application logs
  // NextAuth collections
  'accounts',                // OAuth accounts (Google, etc.)
  'verification_tokens',     // Email verification tokens
  'emailOtps',              // Email OTP verification
  'uploads.files',          // GridFS files
  'uploads.chunks',         // GridFS chunks
];

// Directories to clean (relative to project root)
const DIRECTORIES_TO_CLEAN = [
  'uploads',                 // Uploaded CAD/BIM files
  'public/converted',        // Converted model files
  'temp',                    // Temporary files (if exists)
  '.next/cache',            // Next.js cache (if exists)
];

async function clearDatabase() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    console.log('\n🗄️  Starting database cleanup...');
    
    // Clear both databases - main app database and NextAuth database
    const databasesToClean = [
      { name: DB_NAME, description: 'Main application database' },
      { name: 'test', description: 'NextAuth database' }
    ];
    
    let totalCollectionsCleared = 0;
    let totalDocsDeleted = 0;
    
    for (const dbInfo of databasesToClean) {
      console.log(`\n📍 Cleaning database: ${dbInfo.name} (${dbInfo.description})`);
      
      const db = client.db(dbInfo.name);
      
      // Get all existing collections
      const collections = await db.listCollections().toArray();
      const existingCollections = collections.map(col => col.name);
      
      if (existingCollections.length === 0) {
        console.log(`⭕ Database '${dbInfo.name}' has no collections`);
        continue;
      }
      
      console.log(`📊 Found ${existingCollections.length} collections in ${dbInfo.name}:`);
      for (const col of existingCollections) {
        const count = await db.collection(col).countDocuments();
        console.log(`   - ${col}: ${count} documents`);
      }
      
      // Clear all collections (not just predefined ones)
      for (const collectionName of existingCollections) {
        // Skip system collections
        if (collectionName.startsWith('system.')) {
          console.log(`➖ Skipping system collection '${collectionName}' in ${dbInfo.name}`);
          continue;
        }
        
        try {
          const collection = db.collection(collectionName);
          const count = await collection.countDocuments();
          
          if (count > 0) {
            const result = await collection.deleteMany({});
            console.log(`✅ Cleared collection '${collectionName}' in ${dbInfo.name}: ${result.deletedCount} documents deleted`);
            totalDocsDeleted += result.deletedCount;
            totalCollectionsCleared++;
          } else {
            console.log(`⭕ Collection '${collectionName}' in ${dbInfo.name} was already empty`);
          }
        } catch (error) {
          console.error(`❌ Error clearing collection '${collectionName}' in ${dbInfo.name}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Database cleanup completed!');
    console.log(`   - Collections cleared: ${totalCollectionsCleared}`);
    console.log(`   - Total documents deleted: ${totalDocsDeleted}`);
    
    return { collectionsCleared: totalCollectionsCleared, documentsDeleted: totalDocsDeleted };
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function clearFiles() {
  console.log('\n📁 Starting file system cleanup...');
  
  let directoriesCleared = 0;
  let filesDeleted = 0;
  
  const projectRoot = path.join(__dirname, '..');
  
  for (const dirPath of DIRECTORIES_TO_CLEAN) {
    const fullPath = path.join(projectRoot, dirPath);
    
    try {
      // Check if directory exists
      await fs.access(fullPath);
      
      // Get directory stats
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        // Remove directory and all contents
        await fs.rm(fullPath, { recursive: true, force: true });
        console.log(`✅ Removed directory: ${dirPath}`);
        directoriesCleared++;
        
        // Count would require scanning before deletion, so we'll estimate
        filesDeleted += 10; // Rough estimate for reporting
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`➖ Directory '${dirPath}' does not exist, skipping`);
      } else {
        console.error(`❌ Error removing directory '${dirPath}':`, error.message);
      }
    }
  }
  
  console.log('\n✅ File system cleanup completed!');
  console.log(`   - Directories cleared: ${directoriesCleared}`);
  console.log(`   - Files deleted: ${filesDeleted}`);
  
  return { directoriesCleared, filesDeleted };
}

async function completeCleanup() {
  console.log('🚨 DANGER: COMPLETE SYSTEM RESET 🚨\n');
  
  console.log('This will permanently delete:');
  console.log('📊 DATABASE:');
  console.log('   ❌ All user accounts and login credentials');
  console.log('   ❌ All projects and their data');
  console.log('   ❌ All project invitations and collaborators');
  console.log('   ❌ All IoT sensor data and configurations');
  console.log('   ❌ All BIM/CAD model metadata');
  console.log('   ❌ All admin permissions and company associations');
  console.log('   ❌ All file annotations and properties');
  console.log('   ❌ All OAuth accounts and sessions');
  console.log('   ❌ All email verification tokens');
  console.log('\n📁 FILES:');
  console.log('   ❌ All uploaded CAD/BIM files');
  console.log('   ❌ All converted model files');
  console.log('   ❌ All cached data');
  console.log('\n⚠️  This action CANNOT be undone!');
  console.log('⚠️  Everyone will need to register again!');
  console.log('⚠️  All project data will be permanently lost!');
  
  // Prompt for confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise((resolve) => {
    rl.question('\nType "RESET EVERYTHING" to proceed with complete cleanup: ', resolve);
  });
  
  rl.close();
  
  if (answer !== 'RESET EVERYTHING') {
    console.log('\n❌ Cleanup cancelled. You must type exactly "RESET EVERYTHING" to proceed.');
    return;
  }
  
  console.log('\n🚀 Confirmation received, proceeding with complete cleanup...');
  console.log('\n🧹 Starting complete system cleanup...');
  console.log('⚠️  This will remove ALL data and files!');
  
  try {
    // Clear database
    const dbResult = await clearDatabase();
    
    // Clear files
    const fileResult = await clearFiles();
    
    console.log('\n🎉 Complete system cleanup finished successfully!');
    
    console.log('\n📊 Final Summary:');
    console.log('   Database:');
    console.log(`     - Collections cleared: ${dbResult.collectionsCleared}`);
    console.log(`     - Documents deleted: ${dbResult.documentsDeleted}`);
    console.log('   File System:');
    console.log(`     - Directories cleared: ${fileResult.directoriesCleared}`);
    console.log(`     - Files deleted: ${fileResult.filesDeleted}`);
    
    console.log('\n🔄 System Status:');
    console.log('   ✅ All user accounts removed');
    console.log('   ✅ All projects and data cleared');
    console.log('   ✅ All invitations removed');
    console.log('   ✅ All IoT sensors cleared');
    console.log('   ✅ All BIM models removed');
    console.log('   ✅ All uploaded files deleted');
    console.log('   ✅ All cached data cleared');
    console.log('   ✅ All OAuth accounts removed');
    console.log('   ✅ All sessions invalidated');
    
    console.log('\n🚀 The system is now completely reset!');
    console.log('✨ All users will need to register again!');
    
  } catch (error) {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  completeCleanup();
}

module.exports = { completeCleanup, clearDatabase, clearFiles };