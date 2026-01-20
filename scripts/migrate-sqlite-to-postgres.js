// Script to migrate data from SQLite to PostgreSQL
// Usage: node scripts/migrate-sqlite-to-postgres.js

import Database from 'better-sqlite3';
import pkg from 'pg';
const { Client } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  console.error('Please create .env file with DATABASE_URL');
  process.exit(1);
}

// Load environment variables
import('dotenv').then(dotenv => dotenv.config());

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file!');
  process.exit(1);
}

console.log('🔄 Starting migration from SQLite to PostgreSQL...\n');

// Connect to SQLite
const sqlitePath = path.join(process.cwd(), 'data', 'slideforge.db');

if (!fs.existsSync(sqlitePath)) {
  console.log('⚠️  SQLite database not found at:', sqlitePath);
  console.log('✅ No data to migrate. Starting fresh!');
  process.exit(0);
}

const sqlite = new Database(sqlitePath, { readonly: true });
console.log('✅ Connected to SQLite database');

// Connect to PostgreSQL
const postgres = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await postgres.connect();
console.log('✅ Connected to PostgreSQL database\n');

// Tables to migrate (in order due to foreign keys)
const tables = [
  'users',
  'presentations',
  'activity_logs',
  'login_attempts',
  'editor_actions',
  'slide_changes',
  'presentation_versions',
  'auto_backups',
  'user_templates',
  'settings',
  'notifications',
  'notification_reads',
  'support_tickets',
  'ticket_replies',
  'community_templates',
  'template_likes',
  'security_answer_attempts',
  'user_sessions',
  'visitors'
];

let totalRecords = 0;

for (const table of tables) {
  try {
    console.log(`📦 Migrating table: ${table}`);
    
    // Get all records from SQLite
    const records = sqlite.prepare(`SELECT * FROM ${table}`).all();
    
    if (records.length === 0) {
      console.log(`   ⏭️  No records found\n`);
      continue;
    }
    
    // Get column names
    const columns = Object.keys(records[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');
    
    // Insert into PostgreSQL
    let inserted = 0;
    for (const record of records) {
      const values = columns.map(col => {
        const value = record[col];
        // Convert SQLite boolean (0/1) to PostgreSQL boolean
        if (typeof value === 'number' && (col.includes('is_') || col.includes('success') || col === 'is_admin' || col === 'is_featured')) {
          return value === 1;
        }
        return value;
      });
      
      try {
        await postgres.query(
          `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
        inserted++;
      } catch (err) {
        console.error(`   ⚠️  Error inserting record:`, err.message);
      }
    }
    
    console.log(`   ✅ Migrated ${inserted}/${records.length} records\n`);
    totalRecords += inserted;
    
  } catch (error) {
    console.error(`   ❌ Error migrating ${table}:`, error.message, '\n');
  }
}

// Update sequences for auto-increment columns
console.log('🔧 Updating sequences...');
const sequenceTables = [
  'users', 'activity_logs', 'login_attempts', 'editor_actions', 
  'slide_changes', 'presentation_versions', 'auto_backups', 
  'user_templates', 'notifications', 'notification_reads',
  'support_tickets', 'ticket_replies', 'community_templates',
  'template_likes', 'security_answer_attempts', 'user_sessions', 'visitors'
];

for (const table of sequenceTables) {
  try {
    await postgres.query(`
      SELECT setval(pg_get_serial_sequence('${table}', 'id'), 
      COALESCE((SELECT MAX(id) FROM ${table}), 1), true)
    `);
    console.log(`   ✅ Updated sequence for ${table}`);
  } catch (error) {
    // Ignore errors for tables without id column
  }
}

console.log('\n✅ Migration completed!');
console.log(`📊 Total records migrated: ${totalRecords}`);

// Close connections
sqlite.close();
await postgres.end();

console.log('\n🎉 Done! Your data is now in PostgreSQL.');
