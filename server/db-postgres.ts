import pkg from 'pg';
const { Pool } = pkg;
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// ==================== QUERY HELPERS ====================

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`⚠️ Slow query (${duration}ms): ${text}`);
    }
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

export const getClient = async () => {
  return await pool.connect();
};

// ==================== COMPRESSION HELPERS ====================

export const compressData = async (data: any): Promise<string> => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = await gzip(jsonString);
    return compressed.toString('base64');
  } catch (error) {
    console.error('Compression error:', error);
    return JSON.stringify(data);
  }
};

export const decompressData = async (compressedData: string): Promise<any> => {
  if (!compressedData) {
    console.error('Decompression error: Empty data');
    return null;
  }
  
  try {
    if (compressedData.startsWith('{') || compressedData.startsWith('[')) {
      return JSON.parse(compressedData);
    }
    
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = await gunzip(buffer);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    console.error('Decompression error:', error);
    try {
      return JSON.parse(compressedData);
    } catch (jsonError) {
      console.error('Failed to parse as JSON:', jsonError);
      return {};
    }
  }
};

// ==================== PREPARED STATEMENTS (PostgreSQL Style) ====================

export const preparedStatements = {
  // Users
  getUserById: async (id: number) => {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },
  
  getUserByUsername: async (username: string) => {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  },
  
  updateUserLastLogin: async (id: number) => {
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  },
  
  getAllActiveUsers: async () => {
    const result = await query('SELECT id, username, email, role, created_at, last_login FROM users WHERE is_active = true');
    return result.rows;
  },
  
  // Presentations
  getPresentationById: async (id: string, userId: number) => {
    const result = await query('SELECT * FROM presentations WHERE id = $1 AND user_id = $2', [id, userId]);
    return result.rows[0];
  },
  
  getPresentationsByUser: async (userId: number) => {
    const result = await query('SELECT * FROM presentations WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
    return result.rows;
  },
  
  getPresentationsByUserPaginated: async (userId: number, limit: number, offset: number) => {
    const result = await query(
      'SELECT id, title, slide_count, created_at, updated_at FROM presentations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  },
  
  countPresentationsByUser: async (userId: number) => {
    const result = await query('SELECT COUNT(*) as count FROM presentations WHERE user_id = $1', [userId]);
    return result.rows[0];
  },
  
  insertPresentation: async (id: string, userId: number, title: string, slideCount: number, data: string) => {
    await query(
      'INSERT INTO presentations (id, user_id, title, slide_count, data, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET title = $3, slide_count = $4, data = $5, updated_at = CURRENT_TIMESTAMP',
      [id, userId, title, slideCount, data]
    );
  },
  
  updatePresentation: async (title: string, slideCount: number, data: string, id: string, userId: number) => {
    await query(
      'UPDATE presentations SET title = $1, slide_count = $2, data = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND user_id = $5',
      [title, slideCount, data, id, userId]
    );
  },
  
  updatePresentationMetadata: async (title: string, slideCount: number, id: string, userId: number) => {
    await query(
      'UPDATE presentations SET title = $1, slide_count = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4',
      [title, slideCount, id, userId]
    );
  },
  
  deletePresentation: async (id: string, userId: number) => {
    await query('DELETE FROM presentations WHERE id = $1 AND user_id = $2', [id, userId]);
  },
  
  // Activity logs
  insertActivityLog: async (userId: number | null, username: string, action: string, details: string | null, ipAddress: string | null) => {
    await query(
      'INSERT INTO activity_logs (user_id, username, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, action, details, ipAddress]
    );
  },
  
  getActivityByUser: async (userId: number, limit: number, offset: number) => {
    const result = await query(
      'SELECT action, details, ip_address, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  },
  
  getRecentActivity: async (limit: number) => {
    const result = await query(
      'SELECT user_id, username, action, created_at FROM activity_logs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  },
  
  // Versions
  getVersionsByPresentation: async (presentationId: string, userId: number) => {
    const result = await query(
      'SELECT id, version_number, title, slide_count, change_summary, created_at FROM presentation_versions WHERE presentation_id = $1 AND user_id = $2 ORDER BY version_number DESC LIMIT 50',
      [presentationId, userId]
    );
    return result.rows;
  },
  
  getVersionById: async (id: number, presentationId: string, userId: number) => {
    const result = await query(
      'SELECT * FROM presentation_versions WHERE id = $1 AND presentation_id = $2 AND user_id = $3',
      [id, presentationId, userId]
    );
    return result.rows[0];
  },
  
  insertVersion: async (presentationId: string, userId: number, versionNumber: number, title: string, slideCount: number, data: string, changeSummary: string | null) => {
    await query(
      'INSERT INTO presentation_versions (presentation_id, user_id, version_number, title, slide_count, data, change_summary) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [presentationId, userId, versionNumber, title, slideCount, data, changeSummary]
    );
  },
  
  deleteVersion: async (id: number, userId: number) => {
    await query('DELETE FROM presentation_versions WHERE id = $1 AND user_id = $2', [id, userId]);
  },
  
  getMaxVersionNumber: async (presentationId: string) => {
    const result = await query(
      'SELECT MAX(version_number) as max_version FROM presentation_versions WHERE presentation_id = $1',
      [presentationId]
    );
    return result.rows[0];
  },
  
  countVersionsByPresentation: async (presentationId: string) => {
    const result = await query(
      'SELECT COUNT(*) as count FROM presentation_versions WHERE presentation_id = $1',
      [presentationId]
    );
    return result.rows[0];
  },
  
  // Backups
  getBackupsByPresentation: async (presentationId: string, userId: number) => {
    const result = await query(
      'SELECT id, title, slide_count, backup_type, created_at FROM auto_backups WHERE presentation_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 10',
      [presentationId, userId]
    );
    return result.rows;
  },
  
  insertBackup: async (presentationId: string, userId: number, title: string, slideCount: number, data: string, backupType: string) => {
    await query(
      'INSERT INTO auto_backups (presentation_id, user_id, title, slide_count, data, backup_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [presentationId, userId, title, slideCount, data, backupType]
    );
  },
  
  getBackupById: async (id: number, presentationId: string, userId: number) => {
    const result = await query(
      'SELECT * FROM auto_backups WHERE id = $1 AND presentation_id = $2 AND user_id = $3',
      [id, presentationId, userId]
    );
    return result.rows[0];
  },
  
  // Notifications
  getUnreadNotificationsByUser: async (userId: number, limit: number) => {
    const result = await query(
      `SELECT n.* FROM notifications n
       LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = $1
       WHERE (n.target_user_id = $1 OR n.target_user_id IS NULL)
       AND nr.id IS NULL
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },
  
  markNotificationAsRead: async (notificationId: number, userId: number) => {
    await query(
      'INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2) ON CONFLICT (notification_id, user_id) DO NOTHING',
      [notificationId, userId]
    );
  },
  
  // Community Templates
  getApprovedTemplates: async (status: string, limit: number, offset: number) => {
    const result = await query(
      'SELECT id, name, name_en, description, description_en, category, thumbnail, slide_count, downloads, likes, created_at FROM community_templates WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [status, limit, offset]
    );
    return result.rows;
  },
  
  incrementTemplateDownloads: async (id: number) => {
    await query('UPDATE community_templates SET downloads = downloads + 1 WHERE id = $1', [id]);
  },
  
  // User Sessions
  insertUserSession: async (userId: number, ipAddress: string, userAgent: string) => {
    await query(
      'INSERT INTO user_sessions (user_id, ip_address, user_agent) VALUES ($1, $2, $3)',
      [userId, ipAddress, userAgent]
    );
  },
  
  getActiveSessionsByUser: async (userId: number) => {
    const result = await query(
      'SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    return result.rows;
  },
};

// ==================== SETTINGS HELPERS ====================

export const getSetting = async (key: string, defaultValue: string): Promise<string> => {
  const result = await query('SELECT value FROM settings WHERE key = $1', [key]);
  return result.rows[0]?.value || defaultValue;
};

export const getNumericSetting = async (key: string, defaultValue: number): Promise<number> => {
  const value = await getSetting(key, String(defaultValue));
  return parseInt(value) || defaultValue;
};

// ==================== TRANSACTION HELPERS ====================

export const transaction = async (callback: (client: any) => Promise<void>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await callback(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
