import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { preparedStatements, compressData, decompressData, query, getSetting, getNumericSetting } from '../../server/db-postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'slideforge-secret-key-change-in-production';

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// ==================== QUERY RESULT CACHE ====================
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  
  set(key: string, data: any, ttl: number = 60000) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
  
  invalidate(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear() {
    this.cache.clear();
  }
}

const queryCache = new QueryCache();

// ==================== HELPERS ====================
const logActivity = async (userId: number | null, username: string, action: string, details?: string, ip?: string, userRole?: string) => {
  if (userRole === 'admin') return;
  const importantActions = ['register', 'login', 'password_reset', 'failed_password_reset', 'set_security_question', 'create_presentation', 'create_version', 'restore_version', 'restore_backup'];
  if (importantActions.includes(action)) {
    await preparedStatements.insertActivityLog(userId, username, action, details || null, ip || null);
  }
};

const logLoginAttempt = async (username: string, success: boolean, ip?: string) => {
  if (!success) {
    await query('INSERT INTO login_attempts (username, success, ip_address) VALUES ($1, $2, $3)', [username, false, ip || null]);
  }
};

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    if (!user || (!user.id && !user.userId)) {
      return res.status(403).json({ error: 'Invalid token payload. Please log in again.' });
    }
    req.user = { id: user.id || user.userId, username: user.username, role: user.role };
    next();
  });
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const allowRegistration = await getSetting('allow_registration', 'true');
  
  try {
    let user: any = await preparedStatements.getUserByUsername(username);
    let isNewUser = false;
    
    if (!user) {
      if (allowRegistration === 'false') {
        await logLoginAttempt(username, false, ip as string);
        return res.status(401).json({ error: 'التسجيل مغلق حالياً' });
      }
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = await query(
        'INSERT INTO users (username, password, plain_password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, role, security_question',
        [username, hashedPassword, password, 'user']
      );
      user = result.rows[0];
      isNewUser = true;
      await logActivity(user.id, username, 'register', 'New user registered', ip as string, 'user');
    } else {
      if (!user.is_active) {
        await logLoginAttempt(username, false, ip as string);
        return res.status(401).json({ error: 'الحساب معطل' });
      }
      if (!bcrypt.compareSync(password, user.password)) {
        await logLoginAttempt(username, false, ip as string);
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      }
    }
    
    await preparedStatements.updateUserLastLogin(user.id);
    await logLoginAttempt(username, true, ip as string);
    await logActivity(user.id, username, 'login', 'User logged in', ip as string, user.role);
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role },
      isNewUser,
      needsSecurityQuestion: !user.security_question
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/me', authenticateToken, async (req: any, res) => {
  try {
    const user: any = await preparedStatements.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password;
    delete user.plain_password;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get presentations
app.get('/api/presentations', authenticateToken, async (req: any, res) => {
  try {
    const cacheKey = `presentations_list_${req.user.id}`;
    const cached = queryCache.get(cacheKey);
    if (cached) return res.json(cached);
    
    const result = await query(`
      SELECT id, user_id, title, slide_count, created_at, updated_at, LENGTH(data) as data_size
      FROM presentations WHERE user_id = $1 ORDER BY updated_at DESC
    `, [req.user.id]);
    
    queryCache.set(cacheKey, result.rows, 30000);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
});

// Get single presentation
app.get('/api/presentations/:id', authenticateToken, async (req: any, res) => {
  try {
    const cacheKey = `presentation_${req.params.id}_${req.user.id}`;
    const cached = queryCache.get(cacheKey);
    if (cached) return res.json(cached);
    
    const presentation: any = await preparedStatements.getPresentationById(req.params.id, req.user.id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });
    
    try {
      const data = await decompressData(presentation.data);
      presentation.data = JSON.stringify(data);
    } catch (error) {
      console.error('Decompression error:', error);
    }
    
    queryCache.set(cacheKey, presentation, 120000);
    res.json(presentation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch presentation' });
  }
});

// Create/Update presentation
app.post('/api/presentations', authenticateToken, async (req: any, res) => {
  const { id, title, slideCount, data } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!id || !title) {
    return res.status(400).json({ error: 'ID and title are required' });
  }
  
  try {
    const compressedData = await compressData(data);
    const existing: any = await preparedStatements.getPresentationById(id, req.user.id);
    
    if (existing) {
      if (existing.data === compressedData) {
        return res.json({ success: true, message: 'No changes detected', id, skipped: true });
      }
      await preparedStatements.updatePresentation(title, slideCount || 0, compressedData, id, req.user.id);
      await logActivity(req.user.id, req.user.username, 'update_presentation', `Updated: ${title}`, ip as string, req.user.role);
      queryCache.invalidate(`presentations_list_${req.user.id}`);
      queryCache.invalidate(`presentation_${id}`);
      res.json({ success: true, message: 'Presentation updated', id });
    } else {
      await preparedStatements.insertPresentation(id, req.user.id, title, slideCount || 0, compressedData);
      await logActivity(req.user.id, req.user.username, 'create_presentation', `Created: ${title}`, ip as string, req.user.role);
      queryCache.invalidate(`presentations_list_${req.user.id}`);
      res.json({ success: true, message: 'Presentation created', id });
    }
  } catch (error) {
    console.error('Save presentation error:', error);
    res.status(500).json({ error: 'Failed to save presentation' });
  }
});

// Delete presentation
app.delete('/api/presentations/:id', authenticateToken, async (req: any, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  try {
    const result = await query('SELECT title FROM presentations WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const presentation = result.rows[0];
    
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });
    
    await preparedStatements.deletePresentation(req.params.id, req.user.id);
    await logActivity(req.user.id, req.user.username, 'delete_presentation', `Deleted: ${presentation.title}`, ip as string, req.user.role);
    res.json({ success: true, message: 'Presentation deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete presentation' });
  }
});

// Export as serverless function
export const handler = serverless(app);
