import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { preparedStatements, compressData, decompressData } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
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
// In-memory cache for frequently accessed data

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  
  set(key: string, data: any, ttl: number = 60000) { // Default 1 minute
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  invalidate(pattern: string) {
    // Invalidate all keys matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear() {
    this.cache.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

const queryCache = new QueryCache();

// Clear expired cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of queryCache['cache'].entries()) {
    if (now - entry.timestamp > entry.ttl) {
      queryCache['cache'].delete(key);
    }
  }
}, 300000);

// ==================== USAGE LIMITS HELPERS ====================

// Get a setting value with default
const getSetting = (key: string, defaultValue: string): string => {
  const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return setting?.value || defaultValue;
};

// Get numeric setting
const getNumericSetting = (key: string, defaultValue: number): number => {
  const value = getSetting(key, String(defaultValue));
  return parseInt(value) || defaultValue;
};

// Rate limiting store (in-memory)
const rateLimitStore: Record<string, { count: number; resetTime: number }> = {};

// Check rate limit for a user
const checkRateLimit = (userId: number): { allowed: boolean; remaining: number } => {
  const maxRequests = getNumericSetting('rate_limit_per_minute', 200); // زيادة الحد إلى 200
  if (maxRequests === 0) return { allowed: true, remaining: 999 }; // 0 = unlimited
  
  const now = Date.now();
  const key = `user_${userId}`;
  
  if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
    rateLimitStore[key] = { count: 1, resetTime: now + 60000 };
    return { allowed: true, remaining: maxRequests - 1 };
  }
  
  if (rateLimitStore[key].count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  rateLimitStore[key].count++;
  return { allowed: true, remaining: maxRequests - rateLimitStore[key].count };
};

// Helper to log activity (using prepared statement)
// Only logs important actions for regular users, skips admin activity
const logActivity = (userId: number | null, username: string, action: string, details?: string, ip?: string, userRole?: string) => {
  // Don't log admin activity at all
  if (userRole === 'admin') {
    return;
  }
  
  // List of important actions to log for regular users
  const importantActions = [
    'register',
    'login',
    'password_reset',
    'failed_password_reset',
    'set_security_question',
    'create_presentation',
    'create_version',
    'restore_version',
    'restore_backup'
  ];
  
  // Only log if it's an important action
  if (importantActions.includes(action)) {
    preparedStatements.insertActivityLog.run(userId, username, action, details || null, ip || null);
  }
};

// Helper to log login attempt - Only log failed attempts for security monitoring
const logLoginAttempt = (username: string, success: boolean, ip?: string) => {
  // Only log failed login attempts (security concern)
  if (!success) {
    db.prepare('INSERT INTO login_attempts (username, success, ip_address) VALUES (?, ?, ?)').run(username, 0, ip || null);
  }
};

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Ensure user object has required fields
    if (!user || (!user.id && !user.userId)) {
      console.error('Invalid token payload - missing user ID:', user);
      return res.status(403).json({ error: 'Invalid token payload. Please log in again.' });
    }
    
    // Normalize user object (support both id and userId)
    req.user = {
      id: user.id || user.userId,
      username: user.username,
      role: user.role
    };
    
    next();
  });
};

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Relaxed rate limit for auto-save operations (NO LIMIT)
const relaxedRateLimitMiddleware = (req: any, res: any, next: any) => {
  // No rate limiting for presentation saves
  next();
};

// Disable rate limiting completely for authenticated users
const noRateLimitMiddleware = (req: any, res: any, next: any) => {
  // No rate limiting at all
  next();
};

// ==================== AUTH ROUTES ====================

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Track visitor (public endpoint)
app.post('/api/track-visitor', (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const { pageUrl, referrer } = req.body;
    
    db.prepare('INSERT INTO visitors (ip_address, user_agent, page_url, referrer) VALUES (?, ?, ?, ?)').run(
      ip,
      userAgent,
      pageUrl || '/',
      referrer || ''
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking visitor:', error);
    res.status(500).json({ error: 'Failed to track visitor' });
  }
});

// Login (auto-register if user doesn't exist)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check if registration is allowed
  const settings: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('allow_registration');
  const allowRegistration = settings?.value !== 'false';
  
  try {
    let user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    let isNewUser = false;
    
    // If user doesn't exist
    if (!user) {
      if (!allowRegistration) {
        logLoginAttempt(username, false, ip as string);
        return res.status(401).json({ error: 'التسجيل مغلق حالياً' });
      }
      // Create new account
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare('INSERT INTO users (username, password, plain_password, role) VALUES (?, ?, ?, ?)').run(username, hashedPassword, password, 'user');
      user = { id: result.lastInsertRowid, username, role: 'user', security_question: null };
      isNewUser = true;
      logActivity(user.id, username, 'register', 'New user registered', ip as string, 'user');
      
      // إرسال رسالة ترحيب للمستخدم الجديد
      try {
        db.prepare(`
          INSERT INTO notifications (title, content, type, target_user_id, created_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'مرحباً بك في SlideUP! 🎉',
          'نتمنى لك تجربة رائعة في إنشاء العروض التقديمية',
          'success',
          user.id,
          user.id
        );
        console.log('✅ Welcome notification sent to new user:', username);
      } catch (error) {
        console.error('Failed to send welcome notification:', error);
        console.error('Error details:', error);
      }
    } else {
      // Check if user is active
      if (!user.is_active) {
        logLoginAttempt(username, false, ip as string);
        return res.status(401).json({ error: 'الحساب معطل' });
      }
      // User exists, verify password
      if (!bcrypt.compareSync(password, user.password)) {
        logLoginAttempt(username, false, ip as string);
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      }
    }
    
    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    // Save session info
    const userAgent = req.headers['user-agent'] || 'Unknown';
    db.prepare('INSERT INTO user_sessions (user_id, ip_address, user_agent) VALUES (?, ?, ?)')
      .run(user.id, ip, userAgent);
    
    logLoginAttempt(username, true, ip as string);
    logActivity(user.id, username, 'login', 'User logged in', ip as string, user.role);
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role },
      isNewUser,
      needsSecurityQuestion: !user.security_question
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/me', authenticateToken, (req: any, res) => {
  try {
    const user: any = db.prepare('SELECT id, username, email, role, security_question, created_at, last_login FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ==================== PASSWORD RECOVERY ====================

// Helper to check if user is blocked from security answer attempts
const checkSecurityAnswerBlock = (username: string, ip: string): { blocked: boolean; remainingTime?: number } => {
  const recentAttempt: any = db.prepare(`
    SELECT blocked_until FROM security_answer_attempts 
    WHERE username = ? AND blocked_until IS NOT NULL 
    ORDER BY created_at DESC LIMIT 1
  `).get(username);
  
  if (recentAttempt && recentAttempt.blocked_until) {
    const blockedUntil = new Date(recentAttempt.blocked_until).getTime();
    const now = Date.now();
    
    if (now < blockedUntil) {
      const remainingMinutes = Math.ceil((blockedUntil - now) / 60000);
      return { blocked: true, remainingTime: remainingMinutes };
    }
  }
  
  return { blocked: false };
};

// Helper to log security answer attempt
const logSecurityAnswerAttempt = (username: string, success: boolean, ip: string) => {
  // Count failed attempts in last 30 minutes
  const failedCount: any = db.prepare(`
    SELECT COUNT(*) as count FROM security_answer_attempts 
    WHERE username = ? AND success = 0 
    AND created_at > datetime('now', '-30 minutes')
    AND (blocked_until IS NULL OR blocked_until < datetime('now'))
  `).get(username);
  
  let blockedUntil: string | null = null;
  
  // If this is the 3rd failed attempt, block for 30 minutes
  if (!success && failedCount.count >= 2) {
    const blockTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    blockedUntil = blockTime.toISOString();
  }
  
  db.prepare(`
    INSERT INTO security_answer_attempts (username, success, ip_address, blocked_until) 
    VALUES (?, ?, ?, ?)
  `).run(username, success ? 1 : 0, ip, blockedUntil);
  
  return { blocked: !!blockedUntil, failedCount: failedCount.count + 1 };
};

// Get security question for a username
app.post('/api/get-security-question', (req, res) => {
  const { username } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!username) {
    return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
  }
  
  try {
    // Check if user is blocked
    const blockStatus = checkSecurityAnswerBlock(username, ip as string);
    if (blockStatus.blocked) {
      return res.status(429).json({ 
        error: `تم حظر المحاولات لمدة ${blockStatus.remainingTime} دقيقة بسبب المحاولات الفاشلة المتكررة`,
        blocked: true,
        remainingTime: blockStatus.remainingTime
      });
    }
    
    const user: any = db.prepare('SELECT security_question FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(404).json({ error: 'اسم المستخدم غير موجود' });
    }
    
    if (!user.security_question) {
      return res.status(400).json({ error: 'لم يتم تعيين سؤال أمان لهذا الحساب' });
    }
    
    res.json({ question: user.security_question });
  } catch (error) {
    console.error('Error fetching security question:', error);
    res.status(500).json({ error: 'فشل في جلب سؤال الأمان' });
  }
});

// Verify security answer and reset password
app.post('/api/reset-password', (req, res) => {
  const { username, answer, newPassword } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!username || !answer || !newPassword) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  
  try {
    // Check if user is blocked
    const blockStatus = checkSecurityAnswerBlock(username, ip as string);
    if (blockStatus.blocked) {
      return res.status(429).json({ 
        error: `تم حظر المحاولات لمدة ${blockStatus.remainingTime} دقيقة بسبب المحاولات الفاشلة المتكررة`,
        blocked: true,
        remainingTime: blockStatus.remainingTime
      });
    }
    
    const user: any = db.prepare('SELECT id, username, security_answer FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(404).json({ error: 'اسم المستخدم غير موجود' });
    }
    
    if (!user.security_answer) {
      return res.status(400).json({ error: 'لم يتم تعيين سؤال أمان لهذا الحساب' });
    }
    
    // Compare answers (case-insensitive and trimmed)
    const isCorrect = answer.trim().toLowerCase() === user.security_answer.trim().toLowerCase();
    
    if (!isCorrect) {
      const attemptResult = logSecurityAnswerAttempt(username, false, ip as string);
      logActivity(user.id, username, 'failed_password_reset', 'Wrong security answer', ip as string, 'user');
      
      if (attemptResult.blocked) {
        return res.status(429).json({ 
          error: 'تم حظر المحاولات لمدة 30 دقيقة بسبب 3 محاولات فاشلة متتالية',
          blocked: true,
          remainingTime: 30
        });
      }
      
      const remainingAttempts = 3 - attemptResult.failedCount;
      return res.status(401).json({ 
        error: `الإجابة غير صحيحة. المحاولات المتبقية: ${remainingAttempts}`,
        remainingAttempts
      });
    }
    
    // Log successful attempt
    logSecurityAnswerAttempt(username, true, ip as string);
    
    // Reset password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, plain_password = ? WHERE id = ?').run(hashedPassword, newPassword, user.id);
    
    logActivity(user.id, username, 'password_reset', 'Password reset via security question', ip as string, 'user');
    
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'فشل في إعادة تعيين كلمة المرور' });
  }
});

// Verify security answer only (without resetting password)
app.post('/api/verify-security-answer', (req, res) => {
  const { username, answer } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!username || !answer) {
    return res.status(400).json({ error: 'اسم المستخدم والإجابة مطلوبان' });
  }
  
  try {
    // Check if user is blocked
    const blockStatus = checkSecurityAnswerBlock(username, ip as string);
    if (blockStatus.blocked) {
      return res.status(429).json({ 
        error: `تم حظر المحاولات لمدة ${blockStatus.remainingTime} دقيقة بسبب المحاولات الفاشلة المتكررة`,
        blocked: true,
        remainingTime: blockStatus.remainingTime
      });
    }
    
    const user: any = db.prepare('SELECT id, username, security_answer FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(404).json({ error: 'اسم المستخدم غير موجود' });
    }
    
    if (!user.security_answer) {
      return res.status(400).json({ error: 'لم يتم تعيين سؤال أمان لهذا الحساب' });
    }
    
    // Compare answers (case-insensitive and trimmed)
    const isCorrect = answer.trim().toLowerCase() === user.security_answer.trim().toLowerCase();
    
    if (!isCorrect) {
      const attemptResult = logSecurityAnswerAttempt(username, false, ip as string);
      logActivity(user.id, username, 'failed_answer_verification', 'Wrong security answer', ip as string, 'user');
      
      if (attemptResult.blocked) {
        return res.status(429).json({ 
          error: 'تم حظر المحاولات لمدة 30 دقيقة بسبب 3 محاولات فاشلة متتالية',
          blocked: true,
          remainingTime: 30
        });
      }
      
      const remainingAttempts = 3 - attemptResult.failedCount;
      return res.status(401).json({ 
        error: `الإجابة غير صحيحة. المحاولات المتبقية: ${remainingAttempts}`,
        remainingAttempts
      });
    }
    
    // Log successful attempt
    logSecurityAnswerAttempt(username, true, ip as string);
    logActivity(user.id, username, 'answer_verified', 'Security answer verified successfully', ip as string, 'user');
    
    res.json({ success: true, message: 'الإجابة صحيحة' });
  } catch (error) {
    console.error('Error verifying answer:', error);
    res.status(500).json({ error: 'فشل في التحقق من الإجابة' });
  }
});

// Set security question (for existing users or during registration)
app.post('/api/set-security-question', authenticateToken, (req: any, res) => {
  const { question, answer } = req.body;
  const userId = req.user.id;
  
  if (!question || !answer) {
    return res.status(400).json({ error: 'السؤال والإجابة مطلوبان' });
  }
  
  try {
    db.prepare('UPDATE users SET security_question = ?, security_answer = ? WHERE id = ?').run(question, answer.trim().toLowerCase(), userId);
    
    logActivity(userId, req.user.username, 'set_security_question', 'Security question set', undefined, req.user.role);
    
    res.json({ success: true, message: 'تم حفظ سؤال الأمان بنجاح' });
  } catch (error) {
    console.error('Error setting security question:', error);
    res.status(500).json({ error: 'فشل في حفظ سؤال الأمان' });
  }
});

// ==================== PRESENTATIONS ROUTES ====================

// Get all presentations for current user (with caching + lazy loading)
app.get('/api/presentations', authenticateToken, noRateLimitMiddleware, async (req: any, res) => {
  try {
    const cacheKey = `presentations_list_${req.user.id}`;
    
    // Check cache first
    const cached = queryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Cache hit: presentations list');
      return res.json(cached);
    }
    
    // Lazy loading: only get metadata, not full data
    const presentations = db.prepare(`
      SELECT 
        id, 
        user_id, 
        title, 
        slide_count, 
        created_at, 
        updated_at,
        LENGTH(data) as data_size
      FROM presentations 
      WHERE user_id = ? 
      ORDER BY updated_at DESC
    `).all(req.user.id);
    
    // Cache for 30 seconds (frequently accessed)
    queryCache.set(cacheKey, presentations, 30000);
    
    res.json(presentations);
  } catch (error) {
    console.error('Error fetching presentations:', error);
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
});

// Get single presentation by ID (with caching + decompression)
app.get('/api/presentations/:id', authenticateToken, noRateLimitMiddleware, async (req: any, res) => {
  try {
    const cacheKey = `presentation_${req.params.id}_${req.user.id}`;
    
    // Check cache first
    const cached = queryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Cache hit: presentation', req.params.id);
      return res.json(cached);
    }
    
    const presentation: any = preparedStatements.getPresentationById.get(req.params.id, req.user.id);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    // Decompress data
    try {
      const data = await decompressData(presentation.data);
      presentation.data = JSON.stringify(data);
    } catch (error) {
      console.error('Decompression error:', error);
    }
    
    // Cache for 2 minutes (less frequently changed)
    queryCache.set(cacheKey, presentation, 120000);
    
    res.json(presentation);
  } catch (error) {
    console.error('Error fetching presentation:', error);
    res.status(500).json({ error: 'Failed to fetch presentation' });
  }
});

// Create or update presentation (NO RATE LIMIT + Smart Caching + Compression)
app.post('/api/presentations', authenticateToken, noRateLimitMiddleware, async (req: any, res) => {
  const { id, title, slideCount, data } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!id || !title) {
    return res.status(400).json({ error: 'ID and title are required' });
  }
  
  try {
    // Compress data before saving (saves 60-80% space)
    const compressedData = await compressData(data);
    
    // Check if presentation exists
    const existing: any = preparedStatements.getPresentationById.get(id, req.user.id);
    
    if (existing) {
      // Smart save: only update if data actually changed
      if (existing.data === compressedData) {
        // No changes - return success without writing
        return res.json({ 
          success: true, 
          message: 'No changes detected', 
          id,
          skipped: true 
        });
      }
      
      // Update existing presentation (using prepared statement)
      preparedStatements.updatePresentation.run(title, slideCount || 0, compressedData, id, req.user.id);
      
      logActivity(req.user.id, req.user.username, 'update_presentation', `Updated: ${title}`, ip as string, req.user.role);
      
      // Invalidate cache for this user
      queryCache.invalidate(`presentations_list_${req.user.id}`);
      queryCache.invalidate(`presentation_${id}`);
      
      res.json({ success: true, message: 'Presentation updated', id });
    } else {
      // Create new presentation (using prepared statement)
      preparedStatements.insertPresentation.run(id, req.user.id, title, slideCount || 0, compressedData);
      
      logActivity(req.user.id, req.user.username, 'create_presentation', `Created: ${title}`, ip as string, req.user.role);
      
      // Invalidate cache for this user
      queryCache.invalidate(`presentations_list_${req.user.id}`);
      
      res.json({ success: true, message: 'Presentation created', id });
    }
  } catch (error) {
    console.error('Error saving presentation:', error);
    res.status(500).json({ error: 'Failed to save presentation' });
  }
});

// Delete presentation
app.delete('/api/presentations/:id', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const presentation: any = db.prepare('SELECT title FROM presentations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    db.prepare('DELETE FROM presentations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    logActivity(req.user.id, req.user.username, 'delete_presentation', `Deleted: ${presentation.title}`, ip as string, req.user.role);
    
    res.json({ success: true, message: 'Presentation deleted' });
  } catch (error) {
    console.error('Error deleting presentation:', error);
    res.status(500).json({ error: 'Failed to delete presentation' });
  }
});

// Duplicate presentation
app.post('/api/presentations/:id/duplicate', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const original: any = db.prepare('SELECT * FROM presentations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    
    if (!original) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    const newId = `presentation-${Date.now()}`;
    const newTitle = `${original.title} (Copy)`;
    
    db.prepare('INSERT INTO presentations (id, user_id, title, slide_count, data) VALUES (?, ?, ?, ?, ?)')
      .run(newId, req.user.id, newTitle, original.slide_count, original.data);
    
    logActivity(req.user.id, req.user.username, 'duplicate_presentation', `Duplicated: ${original.title}`, ip as string, req.user.role);
    
    res.json({ success: true, message: 'Presentation duplicated', id: newId });
  } catch (error) {
    console.error('Error duplicating presentation:', error);
    res.status(500).json({ error: 'Failed to duplicate presentation' });
  }
});

// ==================== NOTIFICATIONS ====================

// Get notifications for user
app.get('/api/notifications', authenticateToken, (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Get all notifications for this user (global notifications + user-specific)
    const notifications = db.prepare(`
      SELECT 
        n.id,
        n.title,
        n.content,
        n.type,
        n.created_at,
        CASE WHEN nr.user_id IS NOT NULL THEN 1 ELSE 0 END as is_read
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
      WHERE n.target_user_id IS NULL OR n.target_user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(userId, userId);
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.post('/api/notifications/:id/read', authenticateToken, (req: any, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    // Insert or ignore if already read
    db.prepare(`
      INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
      VALUES (?, ?)
    `).run(notificationId, userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
app.post('/api/notifications/read-all', authenticateToken, (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Get all unread notification IDs for this user
    const unreadNotifications = db.prepare(`
      SELECT n.id
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
      WHERE (n.target_user_id IS NULL OR n.target_user_id = ?)
      AND nr.user_id IS NULL
    `).all(userId, userId);
    
    // Mark each as read
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
      VALUES (?, ?)
    `);
    
    for (const notification of unreadNotifications) {
      insertStmt.run((notification as any).id, userId);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// ==================== USAGE LIMITS ====================

// Get usage limits for user
app.get('/api/limits', authenticateToken, (req: any, res) => {
  try {
    // Return default limits - can be customized per user later
    const limits = {
      maxSlides: getNumericSetting('max_slides_per_presentation', 100),
      maxElements: getNumericSetting('max_elements_per_slide', 50),
      maxPresentations: getNumericSetting('max_presentations_per_user', 50),
      maxExportsPerDay: getNumericSetting('max_exports_per_day', 10),
      canExportPptx: true,
      canExportPdf: true,
      canExportImages: true,
    };
    
    res.json(limits);
  } catch (error) {
    console.error('Error fetching limits:', error);
    res.status(500).json({ error: 'Failed to fetch limits' });
  }
});

// ==================== EDITOR TRACKING ====================

// Track editor actions (for analytics) - DISABLED for regular users
app.post('/api/editor/action', authenticateToken, (req: any, res) => {
  try {
    // Only log for admins if needed, skip for regular users
    // const { action, presentationId, details } = req.body;
    // logActivity(req.user.id, req.user.username, `editor_${action}`, details, req.ip, req.user.role);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking editor action:', error);
    res.status(500).json({ error: 'Failed to track action' });
  }
});

// Track slide changes - DISABLED for regular users
app.post('/api/editor/slide-change', authenticateToken, (req: any, res) => {
  try {
    // Disabled to reduce database load
    // const { presentationId, slideId, changeType, details } = req.body;
    // logActivity(req.user.id, req.user.username, `slide_${changeType}`, JSON.stringify(details), req.ip, req.user.role);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking slide change:', error);
    res.status(500).json({ error: 'Failed to track slide change' });
  }
});

// Track template usage - DISABLED for regular users
app.post('/api/editor/template-usage', authenticateToken, (req: any, res) => {
  try {
    // Disabled to reduce database load
    // const { templateId, templateName, action, presentationId } = req.body;
    // logActivity(req.user.id, req.user.username, `template_${action}`, `${templateName} (${templateId})`, req.ip, req.user.role);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking template usage:', error);
    res.status(500).json({ error: 'Failed to track template usage' });
  }
});

// ==================== VERSION HISTORY ====================

// Get version history for a presentation
app.get('/api/presentations/:id/versions', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  try {
    const versions = db.prepare(`
      SELECT id, version_number, title, slide_count, change_summary, created_at 
      FROM presentation_versions 
      WHERE presentation_id = ? AND user_id = ? 
      ORDER BY version_number DESC
      LIMIT 50
    `).all(req.params.id, req.user.id);
    
    res.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch version history' });
  }
});

// Get specific version data
app.get('/api/presentations/:id/versions/:versionId', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  try {
    const version: any = db.prepare(`
      SELECT * FROM presentation_versions 
      WHERE id = ? AND presentation_id = ? AND user_id = ?
    `).get(req.params.versionId, req.params.id, req.user.id);
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    res.json(version);
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ error: 'Failed to fetch version' });
  }
});

// Create a new version (manual save point)
app.post('/api/presentations/:id/versions', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  const { changeSummary } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const presentation: any = db.prepare('SELECT * FROM presentations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    // Get next version number
    const lastVersion: any = db.prepare(`
      SELECT MAX(version_number) as max_version 
      FROM presentation_versions 
      WHERE presentation_id = ?
    `).get(req.params.id);
    
    const versionNumber = (lastVersion?.max_version || 0) + 1;
    
    // Create version
    const result = db.prepare(`
      INSERT INTO presentation_versions 
      (presentation_id, user_id, version_number, title, slide_count, data, change_summary) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      req.user.id,
      versionNumber,
      presentation.title,
      presentation.slide_count,
      presentation.data,
      changeSummary || 'Manual save'
    );
    
    logActivity(req.user.id, req.user.username, 'create_version', 
      `Version ${versionNumber} of ${presentation.title}`, ip as string, req.user.role);
    
    res.json({ 
      success: true, 
      message: 'Version created', 
      versionId: result.lastInsertRowid,
      versionNumber 
    });
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// Restore a specific version
app.post('/api/presentations/:id/versions/:versionId/restore', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const version: any = db.prepare(`
      SELECT * FROM presentation_versions 
      WHERE id = ? AND presentation_id = ? AND user_id = ?
    `).get(req.params.versionId, req.params.id, req.user.id);
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    // Update presentation with version data
    db.prepare(`
      UPDATE presentations 
      SET title = ?, slide_count = ?, data = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `).run(version.title, version.slide_count, version.data, req.params.id, req.user.id);
    
    logActivity(req.user.id, req.user.username, 'restore_version', 
      `Restored version ${version.version_number} of ${version.title}`, ip as string, req.user.role);
    
    res.json({ success: true, message: 'Version restored' });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Delete a version
app.delete('/api/presentations/:id/versions/:versionId', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const version: any = db.prepare(`
      SELECT version_number, title FROM presentation_versions 
      WHERE id = ? AND presentation_id = ? AND user_id = ?
    `).get(req.params.versionId, req.params.id, req.user.id);
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    db.prepare('DELETE FROM presentation_versions WHERE id = ? AND user_id = ?')
      .run(req.params.versionId, req.user.id);
    
    logActivity(req.user.id, req.user.username, 'delete_version', 
      `Deleted version ${version.version_number} of ${version.title}`, ip as string, req.user.role);
    
    res.json({ success: true, message: 'Version deleted' });
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// ==================== AUTO BACKUPS ====================

// Get auto backups for a presentation
app.get('/api/presentations/:id/backups', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  try {
    const backups = db.prepare(`
      SELECT id, title, slide_count, backup_type, created_at 
      FROM auto_backups 
      WHERE presentation_id = ? AND user_id = ? 
      ORDER BY created_at DESC
      LIMIT 10
    `).all(req.params.id, req.user.id);
    
    res.json(backups);
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
});

// Create auto backup
app.post('/api/presentations/:id/backup', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  try {
    const presentation: any = db.prepare('SELECT * FROM presentations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    // Create backup
    db.prepare(`
      INSERT INTO auto_backups 
      (presentation_id, user_id, title, slide_count, data, backup_type) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      req.user.id,
      presentation.title,
      presentation.slide_count,
      presentation.data,
      'auto'
    );
    
    res.json({ success: true, message: 'Backup created' });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Restore from backup
app.post('/api/presentations/:id/backups/:backupId/restore', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const backup: any = db.prepare(`
      SELECT * FROM auto_backups 
      WHERE id = ? AND presentation_id = ? AND user_id = ?
    `).get(req.params.backupId, req.params.id, req.user.id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    // Update presentation with backup data
    db.prepare(`
      UPDATE presentations 
      SET title = ?, slide_count = ?, data = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `).run(backup.title, backup.slide_count, backup.data, req.params.id, req.user.id);
    
    logActivity(req.user.id, req.user.username, 'restore_backup', 
      `Restored backup of ${backup.title}`, ip as string, req.user.role);
    
    res.json({ success: true, message: 'Backup restored' });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// ==================== ACTIVITY TRACKING ====================

// Get user activity history (with caching)
app.get('/api/activity', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const cacheKey = `activity_${req.user.id}_${limit}_${offset}`;
    
    // Check cache first
    const cached = queryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Cache hit: activity log');
      return res.json(cached);
    }
    
    const activities = preparedStatements.getActivityByUser.all(req.user.id, limit, offset);
    
    // Cache for 10 seconds (frequently updated)
    queryCache.set(cacheKey, activities, 10000);
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get recent changes for a presentation
app.get('/api/presentations/:id/changes', authenticateToken, noRateLimitMiddleware, (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const changes = db.prepare(`
      SELECT slide_id, change_type, element_id, element_type, created_at 
      FROM slide_changes 
      WHERE presentation_id = ? AND user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(req.params.id, req.user.id, limit);
    
    res.json(changes);
  } catch (error) {
    console.error('Error fetching changes:', error);
    res.status(500).json({ error: 'Failed to fetch changes' });
  }
});

// ==================== ADMIN ROUTES ====================

// Middleware to check if user is admin
const isAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// Helper function to parse user agent
const parseUserAgent = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  // Detect Browser
  let browser = 'Unknown';
  if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('opera')) browser = 'Opera';
  
  // Detect Device Type
  let deviceType = 'Desktop';
  if (ua.includes('mobile')) deviceType = 'Mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'Tablet';
  
  return { os, browser, deviceType };
};

// Get all users with detailed info
app.get('/api/admin/users', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, COALESCE(plain_password, '') as plain_password, email, role, is_active, created_at, last_login 
      FROM users 
      ORDER BY created_at DESC
    `).all();
    
    // Enrich each user with additional data
    const enrichedUsers = users.map((user: any) => {
      // Get last IP and user agent
      const lastLogin: any = db.prepare(`
        SELECT ip_address, user_agent FROM user_sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get(user.id);
      
      // Get login count
      const loginCount: any = db.prepare(`
        SELECT COUNT(*) as count FROM login_attempts 
        WHERE username = ? AND success = 1
      `).get(user.username);
      
      // Get failed login attempts
      const failedLogins: any = db.prepare(`
        SELECT COUNT(*) as count FROM login_attempts 
        WHERE username = ? AND success = 0
      `).get(user.username);
      
      // Get presentation count
      const presentationCount: any = db.prepare(`
        SELECT COUNT(*) as count FROM presentations WHERE user_id = ?
      `).get(user.id);
      
      // Get total slides count
      const slidesCount: any = db.prepare(`
        SELECT COALESCE(SUM(slide_count), 0) as count FROM presentations WHERE user_id = ?
      `).get(user.id);
      
      // Get last activity
      const lastActivity: any = db.prepare(`
        SELECT created_at FROM activity_logs 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `).get(user.id);
      
      // Get unique devices count
      const devicesCount: any = db.prepare(`
        SELECT COUNT(DISTINCT user_agent) as count FROM user_sessions WHERE user_id = ?
      `).get(user.id);
      
      // Parse user agent if available
      let deviceInfo = { os: 'Unknown', browser: 'Unknown', deviceType: 'Unknown' };
      if (lastLogin?.user_agent) {
        deviceInfo = parseUserAgent(lastLogin.user_agent);
      }
      
      return {
        ...user,
        last_ip: lastLogin?.ip_address || null,
        user_agent: lastLogin?.user_agent || null,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        device_type: deviceInfo.deviceType,
        login_count: loginCount?.count || 0,
        failed_login_count: failedLogins?.count || 0,
        presentation_count: presentationCount?.count || 0,
        total_slides: slidesCount?.count || 0,
        last_activity: lastActivity?.created_at || null,
        devices_count: devicesCount?.count || 0
      };
    });
    
    res.json(enrichedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get detailed user info
app.get('/api/admin/users/:id/details', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Get user basic info
    const user: any = db.prepare(`
      SELECT id, username, COALESCE(plain_password, '') as plain_password, email, role, is_active, created_at, last_login 
      FROM users WHERE id = ?
    `).get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get all sessions (devices used)
    const sessions = db.prepare(`
      SELECT ip_address, user_agent, created_at 
      FROM user_sessions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all(userId);
    
    // Parse sessions
    const parsedSessions = sessions.map((session: any) => ({
      ...session,
      ...parseUserAgent(session.user_agent || '')
    }));
    
    // Get login history
    const loginHistory = db.prepare(`
      SELECT success, ip_address, created_at 
      FROM login_attempts 
      WHERE username = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all(user.username);
    
    // Get activity summary
    const activitySummary = db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM activity_logs 
      WHERE user_id = ? 
      GROUP BY action 
      ORDER BY count DESC
    `).all(userId);
    
    // Get recent activity
    const recentActivity = db.prepare(`
      SELECT action, details, ip_address, created_at 
      FROM activity_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all(userId);
    
    res.json({
      user,
      sessions: parsedSessions,
      loginHistory,
      activitySummary,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Get admin stats
app.get('/api/admin/stats', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const totalUsers: any = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const admins: any = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
    const activeUsers: any = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get();
    const totalPresentations: any = db.prepare('SELECT COUNT(*) as count FROM presentations').get();
    const failedAttempts: any = db.prepare(`
      SELECT COUNT(*) as count FROM login_attempts 
      WHERE success = 0 AND created_at > datetime('now', '-24 hours')
    `).get();
    const openTickets: any = db.prepare(`
      SELECT COUNT(*) as count FROM support_tickets 
      WHERE status IN ('new', 'in_progress')
    `).get();
    const totalVisitors: any = db.prepare('SELECT COUNT(*) as count FROM visitors').get();
    const visitorsToday: any = db.prepare(`
      SELECT COUNT(*) as count FROM visitors 
      WHERE DATE(created_at) = DATE('now')
    `).get();
    
    res.json({
      totalUsers: totalUsers.count,
      admins: admins.count,
      activeUsers: activeUsers.count,
      totalPresentations: totalPresentations.count,
      failedAttempts: failedAttempts.count,
      openTickets: openTickets?.count || 0,
      totalVisitors: totalVisitors.count,
      visitorsToday: visitorsToday.count
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all presentations
app.get('/api/admin/presentations', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const presentations = db.prepare(`
      SELECT p.id, p.user_id, u.username, p.title, p.slide_count, p.created_at, p.updated_at 
      FROM presentations p 
      LEFT JOIN users u ON p.user_id = u.id 
      ORDER BY p.updated_at DESC
    `).all();
    res.json(presentations);
  } catch (error) {
    console.error('Error fetching presentations:', error);
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
});

// Get activity logs
app.get('/api/admin/logs', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const logs = db.prepare(`
      SELECT id, user_id, username, action, details, ip_address, created_at 
      FROM activity_logs 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get login attempts
app.get('/api/admin/login-attempts', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const attempts = db.prepare(`
      SELECT id, username, success, ip_address, created_at 
      FROM login_attempts 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();
    res.json(attempts);
  } catch (error) {
    console.error('Error fetching login attempts:', error);
    res.status(500).json({ error: 'Failed to fetch login attempts' });
  }
});

// Get editor actions
app.get('/api/admin/editor-actions', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const actions = db.prepare(`
      SELECT id, user_id, username, presentation_id, action_type, action_details, created_at 
      FROM editor_actions 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();
    res.json(actions);
  } catch (error) {
    console.error('Error fetching editor actions:', error);
    res.status(500).json({ error: 'Failed to fetch editor actions' });
  }
});

// Get slide changes
app.get('/api/admin/slide-changes', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const changes = db.prepare(`
      SELECT id, user_id, username, presentation_id, slide_id, change_type, element_id, element_type, old_value, new_value, created_at 
      FROM slide_changes 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();
    res.json(changes);
  } catch (error) {
    console.error('Error fetching slide changes:', error);
    res.status(500).json({ error: 'Failed to fetch slide changes' });
  }
});

// Get template usage
app.get('/api/admin/template-usage', authenticateToken, isAdmin, (req: any, res) => {
  try {
    // Check if table exists and has data
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_templates'
    `).get();
    
    if (!tableExists) {
      return res.json([]);
    }
    
    const usage = db.prepare(`
      SELECT 
        id, 
        user_id, 
        username, 
        template_id, 
        template_name, 
        action, 
        presentation_id, 
        created_at 
      FROM user_templates 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();
    
    res.json(usage || []);
  } catch (error) {
    console.error('Error fetching template usage:', error);
    res.json([]);
  }
});

// Get settings
app.get('/api/admin/settings', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const settingsObj: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
app.patch('/api/admin/settings', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(key, value);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get notifications
app.get('/api/admin/notifications', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const notifications = db.prepare(`
      SELECT 
        n.id, 
        n.title, 
        n.content, 
        n.type, 
        n.target_user_id, 
        n.created_by, 
        u.username as created_by_username,
        (SELECT COUNT(*) FROM notification_reads WHERE notification_id = n.id) as read_count,
        n.created_at 
      FROM notifications n
      LEFT JOIN users u ON n.created_by = u.id
      ORDER BY n.created_at DESC
    `).all();
    
    res.json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notifications', 
      details: error.message 
    });
  }
});

// Create notification
app.post('/api/admin/notifications', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const { title, content, type, target_user_id } = req.body;
    
    console.log('Creating notification - User ID:', req.user.id, 'Username:', req.user.username);
    
    const result = db.prepare(`
      INSERT INTO notifications (title, content, type, target_user_id, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, content, type || 'info', target_user_id || null, req.user.id);
    
    console.log('Notification created successfully with ID:', result.lastInsertRowid);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Error creating notification:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    res.status(500).json({ 
      error: 'Failed to create notification', 
      details: error.message,
      code: error.code 
    });
  }
});

// Delete notification
app.delete('/api/admin/notifications/:id', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Delete notification reads first
    db.prepare('DELETE FROM notification_reads WHERE notification_id = ?').run(id);
    
    // Delete notification
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get support tickets
app.get('/api/admin/tickets', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const tickets = db.prepare(`
      SELECT id, user_id, username, title, description, priority, status, created_at, updated_at 
      FROM support_tickets 
      ORDER BY created_at DESC
    `).all();
    res.json(tickets);
  } catch (error) {
    res.json([]);
  }
});

// Get community templates
app.get('/api/admin/community-templates', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const status = req.query.status;
    let query = `
      SELECT id, user_id, username as author_username, name, category, slide_count, status, is_featured, downloads, created_at 
      FROM community_templates 
    `;
    
    if (status && status !== 'all') {
      query += ` WHERE status = '${status}'`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const templates = db.prepare(query).all();
    res.json(templates);
  } catch (error) {
    res.json([]);
  }
});

// Add user
app.post('/api/admin/users', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const { username, password, email, role } = req.body;
    
    // Check if username exists
    const existing: any = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (username, password, plain_password, email, role) 
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashedPassword, password, email, role);
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// Update user
app.patch('/api/admin/users/:id', authenticateToken, isAdmin, (req: any, res) => {
  try {
    const updates = req.body;
    const userId = req.params.id;
    
    if (updates.password) {
      const hashedPassword = bcrypt.hashSync(updates.password, 10);
      db.prepare('UPDATE users SET password = ?, plain_password = ? WHERE id = ?')
        .run(hashedPassword, updates.password, userId);
    }
    
    if (updates.email !== undefined) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(updates.email, userId);
    }
    
    if (updates.role !== undefined) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(updates.role, userId);
    }
    
    if (updates.is_active !== undefined) {
      db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(updates.is_active ? 1 : 0, userId);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
// Delete user
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, (req: any, res) => {
  const userId = parseInt(req.params.id);
  
  console.log('Attempting to delete user:', userId);
  
  try {
    // Prevent deleting yourself
    if (userId === req.user.id) {
      console.log('Cannot delete own account');
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Check if user exists
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    console.log('User found:', user);
    
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Disable foreign key constraints temporarily
    db.prepare('PRAGMA foreign_keys = OFF').run();
    
    // Start a transaction
    const deleteTransaction = db.transaction(() => {
      // Delete from all related tables
      const tables = [
        'presentations',
        'activity_logs',
        'editor_actions', 
        'slide_changes',
        'template_usage',
        'support_tickets',
        'ticket_replies',
        'community_templates',
        'notifications'
      ];
      
      for (const table of tables) {
        try {
          const result = db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
          console.log(`Deleted from ${table}:`, result.changes);
        } catch (err: any) {
          // Table might not exist or column name is different
          console.log(`Could not delete from ${table}:`, err.message);
        }
      }
      
      // Delete login attempts by username
      try {
        const result = db.prepare('DELETE FROM login_attempts WHERE username = ?').run((user as any).username);
        console.log('Deleted login attempts:', result.changes);
      } catch (err) {
        console.log('Could not delete login attempts');
      }
      
      // Finally delete the user
      console.log('Deleting user...');
      const userResult = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      console.log('User deleted:', userResult.changes);
    });
    
    // Execute the transaction
    deleteTransaction();
    
    // Re-enable foreign key constraints
    db.prepare('PRAGMA foreign_keys = ON').run();
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    // Re-enable foreign key constraints in case of error
    try {
      db.prepare('PRAGMA foreign_keys = ON').run();
    } catch (e) {}
    
    console.error('Error deleting user:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// Delete presentation
app.delete('/api/admin/presentations/:id', authenticateToken, isAdmin, (req: any, res) => {
  try {
    db.prepare('DELETE FROM presentations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting presentation:', error);
    res.status(500).json({ error: 'Failed to delete presentation' });
  }
});

// ==================== SERVE STATIC FILES (PRODUCTION) ====================
// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from dist folder
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Handle React routing - return index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${path.join(process.cwd(), 'data', 'slideforge.db')}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
