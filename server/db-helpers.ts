// Database Helper Functions with Performance Optimizations
// استخدم هذه الدوال في الـ routes بدلاً من الوصول المباشر للـ database

import db, { 
  dbRead, 
  preparedStatements, 
  cache, 
  executeWithRetryAsync,
  measureQuery,
  compressData,
  decompressData
} from './db';

// ==================== USER OPERATIONS ====================

export async function getUserById(userId: number) {
  const cacheKey = `user:${userId}`;
  let user = cache.get(cacheKey);
  
  if (!user) {
    user = measureQuery('getUserById', () => {
      return preparedStatements.getUserById.get(userId);
    });
    
    if (user) {
      cache.set(cacheKey, user, 60000); // Cache for 1 minute
    }
  }
  
  return user;
}

export async function getUserByUsername(username: string) {
  const cacheKey = `user:username:${username}`;
  let user = cache.get(cacheKey);
  
  if (!user) {
    user = measureQuery('getUserByUsername', () => {
      return preparedStatements.getUserByUsername.get(username);
    });
    
    if (user) {
      cache.set(cacheKey, user, 60000);
    }
  }
  
  return user;
}

export async function updateUserLastLogin(userId: number) {
  await executeWithRetryAsync(() => {
    preparedStatements.updateUserLastLogin.run(userId);
  });
  
  // Invalidate user cache
  cache.invalidate(`user:${userId}`);
}

// ==================== PRESENTATION OPERATIONS ====================

export async function getPresentationById(presentationId: string, userId: number) {
  const cacheKey = `presentation:${presentationId}:${userId}`;
  let presentation: any = cache.get(cacheKey);
  
  if (!presentation) {
    presentation = measureQuery('getPresentationById', () => {
      return preparedStatements.getPresentationById.get(presentationId, userId);
    });
    
    if (presentation && presentation.data) {
      // Decompress data
      presentation.data = await decompressData(presentation.data);
      cache.set(cacheKey, presentation, 30000); // Cache for 30 seconds
    }
  }
  
  return presentation;
}

export async function getPresentationsByUser(
  userId: number, 
  page: number = 0, 
  limit: number = 20
) {
  const cacheKey = `presentations:user:${userId}:${page}:${limit}`;
  let presentations = cache.get(cacheKey);
  
  if (!presentations) {
    presentations = measureQuery('getPresentationsByUser', () => {
      // Use pagination for better performance
      return preparedStatements.getPresentationsByUserPaginated
        .all(userId, limit, page * limit);
    });
    
    cache.set(cacheKey, presentations, 30000);
  }
  
  return presentations;
}

export async function savePresentationWithRetry(
  id: string,
  userId: number,
  title: string,
  slideCount: number,
  data: any
) {
  // Compress data before saving
  const compressed = await compressData(data);
  
  // Save with retry logic
  await executeWithRetryAsync(() => {
    return measureQuery('savePresentation', () => {
      preparedStatements.insertPresentation.run(
        id,
        userId,
        title,
        slideCount,
        compressed
      );
    });
  });
  
  // Invalidate related caches
  cache.invalidate(`presentation:${id}`);
  cache.invalidate(`presentations:user:${userId}`);
  cache.invalidate(`dashboard:${userId}`);
}

export async function updatePresentationMetadata(
  id: string,
  userId: number,
  title: string,
  slideCount: number
) {
  // Update only metadata (faster than full update)
  await executeWithRetryAsync(() => {
    return measureQuery('updatePresentationMetadata', () => {
      preparedStatements.updatePresentationMetadata.run(
        title,
        slideCount,
        id,
        userId
      );
    });
  });
  
  // Invalidate caches
  cache.invalidate(`presentation:${id}`);
  cache.invalidate(`presentations:user:${userId}`);
}

export async function deletePresentationWithCleanup(
  presentationId: string,
  userId: number
) {
  await executeWithRetryAsync(() => {
    return measureQuery('deletePresentation', () => {
      // Delete in transaction
      const deletePresentation = preparedStatements.deletePresentation;
      const deleteVersions = db.prepare('DELETE FROM presentation_versions WHERE presentation_id = ?');
      const deleteBackups = db.prepare('DELETE FROM auto_backups WHERE presentation_id = ?');
      
      const transaction = db.transaction(() => {
        deletePresentation.run(presentationId, userId);
        deleteVersions.run(presentationId);
        deleteBackups.run(presentationId);
      });
      
      transaction();
    });
  });
  
  // Invalidate all related caches
  cache.invalidate(`presentation:${presentationId}`);
  cache.invalidate(`presentations:user:${userId}`);
  cache.invalidate(`versions:${presentationId}`);
  cache.invalidate(`backups:${presentationId}`);
}

// ==================== ACTIVITY LOGGING ====================

export async function logActivity(
  userId: number,
  username: string,
  action: string,
  details: string,
  ipAddress: string
) {
  // Activity logs don't need retry (not critical)
  try {
    preparedStatements.insertActivityLog.run(
      userId,
      username,
      action,
      details,
      ipAddress
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging shouldn't break the app
  }
}

export async function getRecentActivity(limit: number = 50) {
  const cacheKey = `activity:recent:${limit}`;
  let activity = cache.get(cacheKey);
  
  if (!activity) {
    activity = measureQuery('getRecentActivity', () => {
      return preparedStatements.getRecentActivity.all(limit);
    });
    
    cache.set(cacheKey, activity, 10000); // Cache for 10 seconds
  }
  
  return activity;
}

// ==================== NOTIFICATIONS ====================

export async function getUnreadNotifications(userId: number, limit: number = 10) {
  // Don't cache notifications (need to be real-time)
  return measureQuery('getUnreadNotifications', () => {
    return preparedStatements.getUnreadNotificationsByUser.all(userId, userId, limit);
  });
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  await executeWithRetryAsync(() => {
    preparedStatements.markNotificationAsRead.run(notificationId, userId);
  });
}

// ==================== TEMPLATES ====================

export async function getApprovedTemplates(
  category: string = 'all',
  page: number = 0,
  limit: number = 20
) {
  const cacheKey = `templates:${category}:${page}:${limit}`;
  let templates = cache.get(cacheKey);
  
  if (!templates) {
    templates = measureQuery('getApprovedTemplates', () => {
      return preparedStatements.getApprovedTemplates.all(
        'approved',
        limit,
        page * limit
      );
    });
    
    // Templates don't change often - cache for 5 minutes
    cache.set(cacheKey, templates, 300000);
  }
  
  return templates;
}

export async function incrementTemplateDownloads(templateId: number) {
  // Fire and forget - don't wait for completion
  executeWithRetryAsync(() => {
    preparedStatements.incrementTemplateDownloads.run(templateId);
  }).catch(error => {
    console.error('Failed to increment downloads:', error);
  });
  
  // Invalidate template cache
  cache.invalidate(`templates:`);
}

// ==================== DASHBOARD DATA ====================

export async function loadUserDashboard(userId: number) {
  const cacheKey = `dashboard:${userId}`;
  let dashboard = cache.get(cacheKey);
  
  if (!dashboard) {
    dashboard = await measureQuery('loadDashboard', async () => {
      // Load multiple things in parallel
      const [presentations, notifications, recentActivity] = await Promise.all([
        getPresentationsByUser(userId, 0, 10),
        getUnreadNotifications(userId, 5),
        measureQuery('getUserActivity', () => {
          return preparedStatements.getActivityByUser.all(userId, 10, 0);
        })
      ]);
      
      return {
        presentations,
        notifications,
        recentActivity,
        stats: {
          totalPresentations: preparedStatements.countPresentationsByUser.get(userId),
          unreadNotifications: notifications.length
        }
      };
    });
    
    // Cache dashboard for 30 seconds
    cache.set(cacheKey, dashboard, 30000);
  }
  
  return dashboard;
}

// ==================== BATCH OPERATIONS ====================

export async function batchUpdatePresentations(updates: Array<{
  id: string;
  userId: number;
  title: string;
  slideCount: number;
}>) {
  await executeWithRetryAsync(() => {
    const transaction = db.transaction(() => {
      for (const update of updates) {
        preparedStatements.updatePresentationMetadata.run(
          update.title,
          update.slideCount,
          update.id,
          update.userId
        );
      }
    });
    
    transaction();
  });
  
  // Invalidate all affected caches
  updates.forEach(update => {
    cache.invalidate(`presentation:${update.id}`);
    cache.invalidate(`presentations:user:${update.userId}`);
  });
}

// ==================== STATISTICS ====================

export async function getDatabaseStats() {
  const cacheKey = 'stats:database';
  let stats = cache.get(cacheKey);
  
  if (!stats) {
    stats = measureQuery('getDatabaseStats', () => {
      return {
        users: dbRead.prepare('SELECT COUNT(*) as count FROM users').get(),
        presentations: dbRead.prepare('SELECT COUNT(*) as count FROM presentations').get(),
        templates: dbRead.prepare('SELECT COUNT(*) as count FROM community_templates WHERE status = ?').get('approved'),
        activeUsers: dbRead.prepare('SELECT COUNT(*) as count FROM users WHERE last_login > datetime("now", "-7 days")').get(),
        cacheSize: cache.size()
      };
    });
    
    // Cache stats for 5 minutes
    cache.set(cacheKey, stats, 300000);
  }
  
  return stats;
}

// ==================== CACHE MANAGEMENT ====================

export function invalidateUserCache(userId: number) {
  cache.invalidate(`user:${userId}`);
  cache.invalidate(`presentations:user:${userId}`);
  cache.invalidate(`dashboard:${userId}`);
}

export function invalidatePresentationCache(presentationId: string) {
  cache.invalidate(`presentation:${presentationId}`);
  cache.invalidate(`versions:${presentationId}`);
  cache.invalidate(`backups:${presentationId}`);
}

export function clearAllCache() {
  cache.clear();
  console.log('✅ All cache cleared');
}

// ==================== HEALTH CHECK ====================

export async function checkDatabaseHealth() {
  try {
    // Test read
    const readTest = dbRead.prepare('SELECT 1 as test').get();
    
    // Test write
    const writeTest = await executeWithRetryAsync(() => {
      return db.prepare('SELECT 1 as test').get();
    });
    
    return {
      status: 'healthy',
      read: readTest ? 'ok' : 'error',
      write: writeTest ? 'ok' : 'error',
      cacheSize: cache.size()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
