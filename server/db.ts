import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const dbPath = path.join(process.cwd(), 'data', 'slideforge.db');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance with concurrent writes
db.pragma('journal_mode = WAL');

// Optimize for better performance with multiple users
db.pragma('synchronous = NORMAL'); // Faster writes, still safe
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('temp_store = MEMORY'); // Use memory for temp tables
db.pragma('mmap_size = 30000000000'); // Memory-mapped I/O for better performance

// Additional optimizations
db.pragma('page_size = 4096'); // Optimal page size
db.pragma('auto_vacuum = INCREMENTAL'); // Automatic space reclamation
db.pragma('busy_timeout = 5000'); // Wait 5 seconds on busy

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    plain_password TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )
`);

// Create activity logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create login attempts table
db.exec(`
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    success INTEGER NOT NULL,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create presentations table
db.exec(`
  CREATE TABLE IF NOT EXISTS presentations (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    title TEXT NOT NULL,
    slide_count INTEGER DEFAULT 0,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create editor actions table (tracks all user actions in editor)
db.exec(`
  CREATE TABLE IF NOT EXISTS editor_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    presentation_id TEXT,
    action_type TEXT NOT NULL,
    action_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create slide_changes table (tracks all slide modifications)
db.exec(`
  CREATE TABLE IF NOT EXISTS slide_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT,
    presentation_id TEXT NOT NULL,
    slide_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    element_id TEXT,
    element_type TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create presentation_versions table (version history)
db.exec(`
  CREATE TABLE IF NOT EXISTS presentation_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presentation_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    slide_count INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    change_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (presentation_id) REFERENCES presentations(id)
  )
`);

// Create auto_backups table (automatic hourly backups)
db.exec(`
  CREATE TABLE IF NOT EXISTS auto_backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presentation_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    slide_count INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    backup_type TEXT DEFAULT 'auto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create user_templates table (tracks templates used/created by users)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT,
    template_id TEXT,
    template_name TEXT,
    action TEXT NOT NULL,
    presentation_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Create notifications table (admin to users)
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    target_user_id INTEGER,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )
`);

// Create notification_reads table (track which users read which notifications)
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES notifications(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(notification_id, user_id)
  )
`);

// Create support_tickets table
db.exec(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create ticket_replies table
db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT,
    message TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create community_templates table (user-uploaded templates for everyone)
db.exec(`
  CREATE TABLE IF NOT EXISTS community_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    description_en TEXT,
    category TEXT DEFAULT 'general',
    thumbnail TEXT,
    data TEXT NOT NULL,
    slide_count INTEGER DEFAULT 1,
    downloads INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    approved_by INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  )
`);

// Create template_likes table (track who liked which template)
db.exec(`
  CREATE TABLE IF NOT EXISTS template_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES community_templates(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(template_id, user_id)
  )
`);

// Create security answer attempts table (for password recovery protection)
db.exec(`
  CREATE TABLE IF NOT EXISTS security_answer_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    success INTEGER NOT NULL,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    blocked_until DATETIME
  )
`);

// ==================== PREPARED STATEMENTS CACHE ====================
// Cache frequently used prepared statements for better performance

const preparedStatements = {
  // Users
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  updateUserLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),
  getAllActiveUsers: db.prepare('SELECT id, username, email, role, created_at, last_login FROM users WHERE is_active = 1'),
  
  // Presentations
  getPresentationById: db.prepare('SELECT * FROM presentations WHERE id = ? AND user_id = ?'),
  getPresentationsByUser: db.prepare('SELECT * FROM presentations WHERE user_id = ? ORDER BY updated_at DESC'),
  getPresentationsByUserPaginated: db.prepare('SELECT id, title, slide_count, created_at, updated_at FROM presentations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
  countPresentationsByUser: db.prepare('SELECT COUNT(*) as count FROM presentations WHERE user_id = ?'),
  insertPresentation: db.prepare('INSERT OR REPLACE INTO presentations (id, user_id, title, slide_count, data, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'),
  updatePresentation: db.prepare('UPDATE presentations SET title = ?, slide_count = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
  updatePresentationMetadata: db.prepare('UPDATE presentations SET title = ?, slide_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),
  deletePresentation: db.prepare('DELETE FROM presentations WHERE id = ? AND user_id = ?'),
  
  // Activity logs
  insertActivityLog: db.prepare('INSERT INTO activity_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'),
  getActivityByUser: db.prepare('SELECT action, details, ip_address, created_at FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  getRecentActivity: db.prepare('SELECT user_id, username, action, created_at FROM activity_logs ORDER BY created_at DESC LIMIT ?'),
  
  // Versions
  getVersionsByPresentation: db.prepare('SELECT id, version_number, title, slide_count, change_summary, created_at FROM presentation_versions WHERE presentation_id = ? AND user_id = ? ORDER BY version_number DESC LIMIT 50'),
  getVersionById: db.prepare('SELECT * FROM presentation_versions WHERE id = ? AND presentation_id = ? AND user_id = ?'),
  insertVersion: db.prepare('INSERT INTO presentation_versions (presentation_id, user_id, version_number, title, slide_count, data, change_summary) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  deleteVersion: db.prepare('DELETE FROM presentation_versions WHERE id = ? AND user_id = ?'),
  getMaxVersionNumber: db.prepare('SELECT MAX(version_number) as max_version FROM presentation_versions WHERE presentation_id = ?'),
  countVersionsByPresentation: db.prepare('SELECT COUNT(*) as count FROM presentation_versions WHERE presentation_id = ?'),
  
  // Backups
  getBackupsByPresentation: db.prepare('SELECT id, title, slide_count, backup_type, created_at FROM auto_backups WHERE presentation_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10'),
  insertBackup: db.prepare('INSERT INTO auto_backups (presentation_id, user_id, title, slide_count, data, backup_type) VALUES (?, ?, ?, ?, ?, ?)'),
  getBackupById: db.prepare('SELECT * FROM auto_backups WHERE id = ? AND presentation_id = ? AND user_id = ?'),
  
  // Notifications
  getUnreadNotificationsByUser: db.prepare(`
    SELECT n.* FROM notifications n
    LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
    WHERE (n.target_user_id = ? OR n.target_user_id IS NULL)
    AND nr.id IS NULL
    ORDER BY n.created_at DESC
    LIMIT ?
  `),
  markNotificationAsRead: db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)'),
  
  // Community Templates
  getApprovedTemplates: db.prepare('SELECT id, name, name_en, description, description_en, category, thumbnail, slide_count, downloads, likes, created_at FROM community_templates WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  incrementTemplateDownloads: db.prepare('UPDATE community_templates SET downloads = downloads + 1 WHERE id = ?'),
};

// ==================== COMPRESSION HELPERS ====================

// Compress data before saving (saves 60-80% space)
export const compressData = async (data: any): Promise<string> => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = await gzip(jsonString);
    return compressed.toString('base64');
  } catch (error) {
    console.error('Compression error:', error);
    return JSON.stringify(data); // Fallback to uncompressed
  }
};

// Decompress data after loading
export const decompressData = async (compressedData: string): Promise<any> => {
  if (!compressedData) {
    console.error('Decompression error: Empty data');
    return null;
  }
  
  try {
    // Check if data is compressed (base64) or plain JSON
    if (compressedData.startsWith('{') || compressedData.startsWith('[')) {
      // Plain JSON - not compressed
      return JSON.parse(compressedData);
    }
    
    // Compressed data
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = await gunzip(buffer);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.error('Decompression error:', error);
    // Try parsing as plain JSON as last resort
    try {
      return JSON.parse(compressedData);
    } catch (jsonError) {
      console.error('Failed to parse as JSON:', jsonError);
      // Return empty object instead of null to prevent crashes
      return {};
    }
  }
};

// Export prepared statements for use in routes
export { preparedStatements };

// ==================== CONNECTION POOL & CONCURRENCY ====================
// Better-sqlite3 is synchronous and single-threaded, but we can optimize for concurrent access

// Read-only connection for SELECT queries (improves concurrency)
const dbReadOnly = new Database(dbPath, { readonly: true, fileMustExist: true });
dbReadOnly.pragma('query_only = ON');

// Export read-only connection for SELECT operations
export const dbRead = dbReadOnly;

// ==================== QUERY HELPERS WITH RETRY LOGIC ====================
// Retry logic for handling SQLITE_BUSY errors during high concurrency

const MAX_RETRIES = 5;
const RETRY_DELAY = 100; // milliseconds

export const executeWithRetry = <T>(
  operation: () => T,
  retries = MAX_RETRIES
): T => {
  try {
    return operation();
  } catch (error: any) {
    if (error.code === 'SQLITE_BUSY' && retries > 0) {
      // Wait and retry
      const delay = RETRY_DELAY * (MAX_RETRIES - retries + 1);
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait (blocking)
      }
      return executeWithRetry(operation, retries - 1);
    }
    throw error;
  }
};

// Async version with proper delay
export const executeWithRetryAsync = async <T>(
  operation: () => T,
  retries = MAX_RETRIES
): Promise<T> => {
  try {
    return operation();
  } catch (error: any) {
    if (error.code === 'SQLITE_BUSY' && retries > 0) {
      const delay = RETRY_DELAY * (MAX_RETRIES - retries + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetryAsync(operation, retries - 1);
    }
    throw error;
  }
};

// ==================== CACHING LAYER ====================
// Simple in-memory cache for frequently accessed data

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number = 1000;

  set<T>(key: string, data: T, ttl: number = 60000): void {
    // Auto-cleanup if cache is too large
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern: string): void {
    // Invalidate all keys matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const cache = new SimpleCache();

// ==================== PERFORMANCE MONITORING ====================
// Track query performance for optimization

interface QueryStats {
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
}

class PerformanceMonitor {
  private stats: Map<string, QueryStats> = new Map();

  track(queryName: string, duration: number): void {
    const existing = this.stats.get(queryName) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    existing.maxTime = Math.max(existing.maxTime, duration);

    this.stats.set(queryName, existing);
  }

  getStats(): Map<string, QueryStats> {
    return this.stats;
  }

  getSlowQueries(threshold: number = 100): Array<[string, QueryStats]> {
    return Array.from(this.stats.entries())
      .filter(([_, stats]) => stats.avgTime > threshold)
      .sort((a, b) => b[1].avgTime - a[1].avgTime);
  }

  reset(): void {
    this.stats.clear();
  }
}

export const perfMonitor = new PerformanceMonitor();

// Helper to measure query performance
export const measureQuery = <T>(queryName: string, operation: () => T): T => {
  const start = Date.now();
  try {
    return operation();
  } finally {
    const duration = Date.now() - start;
    perfMonitor.track(queryName, duration);
    
    // Log slow queries
    if (duration > 100) {
      console.warn(`⚠️ Slow query detected: ${queryName} took ${duration}ms`);
    }
  }
};

// ==================== BATCH OPERATIONS ====================
// Execute multiple operations in a single transaction for better performance

// Whitelist of allowed tables for batch operations (security)
const ALLOWED_TABLES = [
  'users', 'activity_logs', 'login_attempts', 'presentations', 
  'editor_actions', 'slide_changes', 'presentation_versions', 
  'auto_backups', 'user_templates', 'settings', 'notifications',
  'notification_reads', 'support_tickets', 'ticket_replies',
  'community_templates', 'template_likes', 'security_answer_attempts',
  'user_sessions'
];

export const batchInsert = (table: string, records: any[]) => {
  if (!records || records.length === 0) return;
  
  // Validate table name to prevent SQL injection
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  
  const transaction = db.transaction((items: any[]) => {
    for (const item of items) {
      const keys = Object.keys(item);
      const values = Object.values(item);
      const placeholders = keys.map(() => '?').join(', ');
      const columns = keys.join(', ');
      
      // Table name is validated above, so this is safe
      const stmt = db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`);
      stmt.run(...values);
    }
  });
  
  return transaction(records);
};

// Batch update with transaction
export const batchUpdate = (updates: Array<{ statement: any; params: any[] }>) => {
  const transaction = db.transaction(() => {
    for (const { statement, params } of updates) {
      statement.run(...params);
    }
  });
  
  return transaction();
};

// Batch delete with transaction
export const batchDelete = (statement: any, ids: any[]) => {
  const transaction = db.transaction(() => {
    for (const id of ids) {
      statement.run(id);
    }
  });
  
  return transaction();
};

// Create user_sessions table (track user devices and sessions)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Add user session prepared statements after table creation
(preparedStatements as any).insertUserSession = db.prepare('INSERT INTO user_sessions (user_id, ip_address, user_agent) VALUES (?, ?, ?)');
(preparedStatements as any).getActiveSessionsByUser = db.prepare('SELECT * FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10');

// Create visitors table (track all site visitors)
db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT,
    user_agent TEXT,
    page_url TEXT,
    referrer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create indexes for better performance
db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_security_answer_attempts_username ON security_answer_attempts(username)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_security_answer_attempts_created_at ON security_answer_attempts(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_editor_actions_created_at ON editor_actions(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_editor_actions_user_id ON editor_actions(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_presentations_user_id ON presentations(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_slide_changes_user_id ON slide_changes(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_slide_changes_presentation_id ON slide_changes(presentation_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_slide_changes_created_at ON slide_changes(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_user_templates_user_id ON user_templates(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON ticket_replies(ticket_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_community_templates_user ON community_templates(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_community_templates_status ON community_templates(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_community_templates_category ON community_templates(category)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_template_likes_template ON template_likes(template_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_template_likes_user ON template_likes(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_presentation_versions_presentation ON presentation_versions(presentation_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_presentation_versions_created_at ON presentation_versions(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_auto_backups_presentation ON auto_backups(presentation_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_auto_backups_created_at ON auto_backups(created_at)`);

// ==================== ADDITIONAL PERFORMANCE INDEXES ====================
// Composite indexes for frequently used query combinations

// Presentations - composite index for user + updated_at (for sorting)
db.exec(`CREATE INDEX IF NOT EXISTS idx_presentations_user_updated ON presentations(user_id, updated_at DESC)`);

// Presentations - index on id for faster lookups
db.exec(`CREATE INDEX IF NOT EXISTS idx_presentations_id ON presentations(id)`);

// Activity logs - composite index for user + created_at (for pagination)
db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_user_created ON activity_logs(user_id, created_at DESC)`);

// Versions - composite index for presentation + version_number
db.exec(`CREATE INDEX IF NOT EXISTS idx_versions_pres_version ON presentation_versions(presentation_id, version_number DESC)`);

// Versions - composite index for user + presentation
db.exec(`CREATE INDEX IF NOT EXISTS idx_versions_user_pres ON presentation_versions(user_id, presentation_id)`);

// Backups - composite index for presentation + created_at
db.exec(`CREATE INDEX IF NOT EXISTS idx_backups_pres_created ON auto_backups(presentation_id, created_at DESC)`);

// Users - index on username for faster login
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

// Users - index on email for faster lookup
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

// Slide changes - composite index for presentation + created_at
db.exec(`CREATE INDEX IF NOT EXISTS idx_slide_changes_pres_created ON slide_changes(presentation_id, created_at DESC)`);

// Editor actions - composite index for user + presentation
db.exec(`CREATE INDEX IF NOT EXISTS idx_editor_actions_user_pres ON editor_actions(user_id, presentation_id)`);

// User sessions - indexes for better performance
db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at)`);

// Visitors - indexes for better performance
db.exec(`CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_visitors_ip ON visitors(ip_address)`);

// Add columns if not exist (for existing databases)
const addColumnIfNotExists = (table: string, column: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    // Column already exists
  }
};

addColumnIfNotExists('users', 'plain_password', 'TEXT');
addColumnIfNotExists('users', 'is_active', 'INTEGER DEFAULT 1');
addColumnIfNotExists('users', 'storage_used', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'security_question', 'TEXT');
addColumnIfNotExists('users', 'security_answer', 'TEXT');

// Initialize default settings
const defaultSettings: Record<string, string> = {
  // General
  site_name: 'SlideUP',
  allow_registration: 'true',
  welcome_message: 'مرحباً بك في SlideUP',
  welcome_message_en: 'Welcome to SlideUP',
  
  // Usage Limits - Presentations & Slides
  max_presentations: '0', // 0 = unlimited
  max_slides: '0', // 0 = unlimited
  max_elements_per_slide: '0', // 0 = unlimited
  
  // Usage Limits - Files & Storage
  max_file_size_mb: '5',
  max_storage_mb: '0', // 0 = unlimited
  allowed_file_types: 'jpg,jpeg,png,gif,svg,webp',
  
  // Usage Limits - Export
  max_exports_per_day: '0', // 0 = unlimited
  allowed_export_formats: 'pdf,pptx,png,jpg',
  export_quality: 'high', // high, medium, low
  
  // Usage Limits - Templates
  max_templates_per_user: '0', // 0 = unlimited
  allow_custom_templates: 'true',
  allow_community_templates: 'true', // Allow users to upload templates
  require_template_approval: 'true', // Admin must approve templates
  
  // Usage Limits - Editor
  enable_animations: 'true',
  max_custom_fonts: '0', // 0 = unlimited
  
  // Usage Limits - Rate & Time
  rate_limit_per_minute: '60', // 0 = unlimited
  inactivity_timeout: '30', // minutes
};

Object.entries(defaultSettings).forEach(([key, value]) => {
  const exists = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
  if (!exists) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
});

// Create default admin if not exists (with extra strong encryption)
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  // Use 14 salt rounds for admin (much stronger than default 10)
  // NOTE: Change default password after first login!
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || '01021303309';
  const hashedPassword = bcrypt.hashSync(defaultAdminPassword, 14);
  // Admin password is NOT stored in plain_password for security
  db.prepare('INSERT INTO users (username, password, plain_password, role) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, null, 'admin');
  console.log('Default admin created with strong encryption');
} else {
  // Update existing admin to remove plain_password and use stronger hash
  const admin: any = db.prepare('SELECT id, plain_password FROM users WHERE username = ?').get('admin');
  if (admin && admin.plain_password) {
    const defaultAdminPassword = process.env.ADMIN_PASSWORD || '01021303309';
    const strongHash = bcrypt.hashSync(defaultAdminPassword, 14);
    db.prepare('UPDATE users SET password = ?, plain_password = NULL WHERE username = ?').run(strongHash, 'admin');
    console.log('Admin password upgraded to strong encryption');
  }
}

// Cleanup old logs (older than 30 days) and old backups (keep only last 10 per presentation)
const cleanupOldLogs = () => {
  try {
    console.log('🧹 Starting cleanup of old logs...');
    
    // Use proper parameterized queries to prevent SQL injection
    db.exec(`DELETE FROM activity_logs WHERE created_at < datetime('now', '-30 days')`);
    db.exec(`DELETE FROM login_attempts WHERE created_at < datetime('now', '-30 days')`);
    db.exec(`DELETE FROM editor_actions WHERE created_at < datetime('now', '-30 days')`);
    db.exec(`DELETE FROM slide_changes WHERE created_at < datetime('now', '-30 days')`);
    db.exec(`DELETE FROM user_templates WHERE created_at < datetime('now', '-30 days')`);
    db.exec(`DELETE FROM security_answer_attempts WHERE created_at < datetime('now', '-30 days')`);
    
    // Clean up old user sessions (older than 90 days)
    db.exec(`DELETE FROM user_sessions WHERE created_at < datetime('now', '-90 days')`);
    
    // Keep only last 10 backups per presentation (safer approach)
    const presentations = db.prepare('SELECT DISTINCT presentation_id FROM auto_backups').all() as any[];
    
    for (const { presentation_id } of presentations) {
      // Get IDs to keep (last 10)
      const keepIds = db.prepare(`
        SELECT id FROM auto_backups 
        WHERE presentation_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      `).all(presentation_id).map((row: any) => row.id);
      
      if (keepIds.length > 0) {
        // Delete old backups for this presentation
        const placeholders = keepIds.map(() => '?').join(',');
        db.prepare(`
          DELETE FROM auto_backups 
          WHERE presentation_id = ? 
          AND id NOT IN (${placeholders})
        `).run(presentation_id, ...keepIds);
      }
    }
    
    console.log('✅ Old logs and backups cleaned up successfully');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
};

// ==================== DATABASE MAINTENANCE ====================
// Vacuum and Analyze for optimal performance

const performDatabaseMaintenance = () => {
  try {
    console.log('🔧 Starting database maintenance...');
    
    // Analyze all tables to update statistics
    db.exec('ANALYZE');
    console.log('✅ Database analyzed');
    
    // Incremental vacuum to reclaim space
    db.exec('PRAGMA incremental_vacuum');
    console.log('✅ Incremental vacuum completed');
    
    // Get database size
    const sizeResult: any = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
    const sizeMB = (sizeResult.size / 1024 / 1024).toFixed(2);
    console.log(`📊 Database size: ${sizeMB} MB`);
    
    // Optimize (reindex if needed)
    db.exec('PRAGMA optimize');
    console.log('✅ Database optimized');
    
    console.log('✅ Database maintenance completed successfully');
  } catch (error) {
    console.error('❌ Database maintenance error:', error);
  }
};

// Store interval IDs for cleanup on shutdown
const intervals: NodeJS.Timeout[] = [];

// Run cleanup on startup
cleanupOldLogs();

// Run maintenance on startup
performDatabaseMaintenance();

// Schedule cleanup every 24 hours
intervals.push(setInterval(() => {
  cleanupOldLogs();
}, 24 * 60 * 60 * 1000));

// Schedule maintenance every 7 days
intervals.push(setInterval(() => {
  performDatabaseMaintenance();
}, 7 * 24 * 60 * 60 * 1000));

// Graceful shutdown handler
export const closeDatabase = () => {
  console.log('🔒 Closing database connections...');
  
  // Clear all intervals
  intervals.forEach(interval => clearInterval(interval));
  
  // Clear cache
  cache.clear();
  
  // Log performance stats before closing
  const slowQueries = perfMonitor.getSlowQueries(50);
  if (slowQueries.length > 0) {
    console.log('📊 Slow queries detected:');
    slowQueries.slice(0, 5).forEach(([name, stats]) => {
      console.log(`  - ${name}: avg ${stats.avgTime.toFixed(2)}ms, max ${stats.maxTime}ms, count ${stats.count}`);
    });
  }
  
  // Close database connections
  try {
    dbRead.close();
    db.close();
    console.log('✅ Database connections closed successfully');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

// Handle uncaught errors to prevent database corruption
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  closeDatabase();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, just log it
});

export default db;
