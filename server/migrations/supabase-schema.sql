-- ==================== SUPABASE POSTGRESQL SCHEMA ====================
-- Migration from SQLite to PostgreSQL for Netlify deployment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    plain_password TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    security_question TEXT,
    security_answer TEXT,
    storage_used BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- ==================== PRESENTATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS presentations (
    id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slide_count INTEGER DEFAULT 0,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== ACTIVITY LOGS TABLE ====================
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== LOGIN ATTEMPTS TABLE ====================
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== EDITOR ACTIONS TABLE ====================
CREATE TABLE IF NOT EXISTS editor_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    presentation_id TEXT,
    action_type TEXT NOT NULL,
    action_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== SLIDE CHANGES TABLE ====================
CREATE TABLE IF NOT EXISTS slide_changes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    presentation_id TEXT NOT NULL,
    slide_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    element_id TEXT,
    element_type TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== PRESENTATION VERSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS presentation_versions (
    id SERIAL PRIMARY KEY,
    presentation_id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    slide_count INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== AUTO BACKUPS TABLE ====================
CREATE TABLE IF NOT EXISTS auto_backups (
    id SERIAL PRIMARY KEY,
    presentation_id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slide_count INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    backup_type TEXT DEFAULT 'auto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== USER TEMPLATES TABLE ====================
CREATE TABLE IF NOT EXISTS user_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    template_id TEXT,
    template_name TEXT,
    action TEXT NOT NULL,
    presentation_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== SETTINGS TABLE ====================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- ==================== NOTIFICATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== NOTIFICATION READS TABLE ====================
CREATE TABLE IF NOT EXISTS notification_reads (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_id, user_id)
);

-- ==================== SUPPORT TICKETS TABLE ====================
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== TICKET REPLIES TABLE ====================
CREATE TABLE IF NOT EXISTS ticket_replies (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    message TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== COMMUNITY TEMPLATES TABLE ====================
CREATE TABLE IF NOT EXISTS community_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ==================== TEMPLATE LIKES TABLE ====================
CREATE TABLE IF NOT EXISTS template_likes (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES community_templates(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, user_id)
);

-- ==================== SECURITY ANSWER ATTEMPTS TABLE ====================
CREATE TABLE IF NOT EXISTS security_answer_attempts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP
);

-- ==================== USER SESSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== VISITORS TABLE ====================
CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    ip_address TEXT,
    user_agent TEXT,
    page_url TEXT,
    referrer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES FOR PERFORMANCE ====================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Presentations indexes
CREATE INDEX IF NOT EXISTS idx_presentations_user_id ON presentations(user_id);
CREATE INDEX IF NOT EXISTS idx_presentations_id ON presentations(id);
CREATE INDEX IF NOT EXISTS idx_presentations_user_updated ON presentations(user_id, updated_at DESC);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user_created ON activity_logs(user_id, created_at DESC);

-- Login attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);

-- Security answer attempts indexes
CREATE INDEX IF NOT EXISTS idx_security_answer_attempts_username ON security_answer_attempts(username);
CREATE INDEX IF NOT EXISTS idx_security_answer_attempts_created_at ON security_answer_attempts(created_at);

-- Editor actions indexes
CREATE INDEX IF NOT EXISTS idx_editor_actions_user_id ON editor_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_editor_actions_created_at ON editor_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_editor_actions_user_pres ON editor_actions(user_id, presentation_id);

-- Slide changes indexes
CREATE INDEX IF NOT EXISTS idx_slide_changes_user_id ON slide_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_slide_changes_presentation_id ON slide_changes(presentation_id);
CREATE INDEX IF NOT EXISTS idx_slide_changes_created_at ON slide_changes(created_at);
CREATE INDEX IF NOT EXISTS idx_slide_changes_pres_created ON slide_changes(presentation_id, created_at DESC);

-- Versions indexes
CREATE INDEX IF NOT EXISTS idx_presentation_versions_presentation ON presentation_versions(presentation_id);
CREATE INDEX IF NOT EXISTS idx_presentation_versions_created_at ON presentation_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_versions_pres_version ON presentation_versions(presentation_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_versions_user_pres ON presentation_versions(user_id, presentation_id);

-- Backups indexes
CREATE INDEX IF NOT EXISTS idx_auto_backups_presentation ON auto_backups(presentation_id);
CREATE INDEX IF NOT EXISTS idx_auto_backups_created_at ON auto_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_backups_pres_created ON auto_backups(presentation_id, created_at DESC);

-- User templates indexes
CREATE INDEX IF NOT EXISTS idx_user_templates_user_id ON user_templates(user_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);

-- Support tickets indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON ticket_replies(ticket_id);

-- Community templates indexes
CREATE INDEX IF NOT EXISTS idx_community_templates_user ON community_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_community_templates_status ON community_templates(status);
CREATE INDEX IF NOT EXISTS idx_community_templates_category ON community_templates(category);
CREATE INDEX IF NOT EXISTS idx_template_likes_template ON template_likes(template_id);
CREATE INDEX IF NOT EXISTS idx_template_likes_user ON template_likes(user_id);

-- User sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at);

-- Visitors indexes
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_visitors_ip ON visitors(ip_address);

-- ==================== DEFAULT SETTINGS ====================
INSERT INTO settings (key, value) VALUES
    ('site_name', 'SlideUP'),
    ('allow_registration', 'true'),
    ('welcome_message', 'مرحباً بك في SlideUP'),
    ('welcome_message_en', 'Welcome to SlideUP'),
    ('max_presentations', '0'),
    ('max_slides', '0'),
    ('max_elements_per_slide', '0'),
    ('max_file_size_mb', '5'),
    ('max_storage_mb', '0'),
    ('allowed_file_types', 'jpg,jpeg,png,gif,svg,webp'),
    ('max_exports_per_day', '0'),
    ('allowed_export_formats', 'pdf,pptx,png,jpg'),
    ('export_quality', 'high'),
    ('max_templates_per_user', '0'),
    ('allow_custom_templates', 'true'),
    ('allow_community_templates', 'true'),
    ('require_template_approval', 'true'),
    ('enable_animations', 'true'),
    ('max_custom_fonts', '0'),
    ('rate_limit_per_minute', '60'),
    ('inactivity_timeout', '30')
ON CONFLICT (key) DO NOTHING;

-- ==================== CREATE DEFAULT ADMIN ====================
-- Password: 01021303309 (CHANGE THIS AFTER FIRST LOGIN!)
-- Hash generated with bcrypt rounds=14
INSERT INTO users (username, password, role, is_active)
VALUES ('admin', '$2b$14$VxBt1OlGMIsfojcjSjbW2uw0gXBuMtZFh/Gx/IXHU1Sq.icCSe9CG', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for presentations
CREATE TRIGGER update_presentations_updated_at BEFORE UPDATE ON presentations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for community_templates
CREATE TRIGGER update_community_templates_updated_at BEFORE UPDATE ON community_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for support_tickets
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== ROW LEVEL SECURITY (Optional) ====================
-- Uncomment if you want to enable RLS

-- ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can only access their own presentations"
--     ON presentations FOR ALL
--     USING (user_id = current_setting('app.current_user_id')::integer);

COMMIT;
