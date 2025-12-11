-- KeyReply Kira AI Database Schema
-- D1 Database Migration for Email Service

-- ============================================
-- Email Logs Table
-- ============================================

-- Email logs table for tracking all sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  to_address TEXT NOT NULL,
  from_address TEXT,
  subject TEXT,
  template TEXT,
  status TEXT DEFAULT 'sent',
  resend_id TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  bounced_at TEXT,
  error TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant ON email_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_address ON email_logs(to_address);

-- ============================================
-- Supporting Tables (if needed in future)
-- ============================================

-- Tenants table (if not already exists)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'free',
  settings TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Users table (if not already exists)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  permissions TEXT DEFAULT '[]',
  password_hash TEXT,
  avatar_url TEXT,
  settings TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_tenant ON users(email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Sessions table (if not already exists)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  last_activity TEXT,
  ip_address TEXT,
  user_agent TEXT,
  revoked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- API Keys table (if not already exists)
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT DEFAULT '[]',
  rate_limit INTEGER DEFAULT 1000,
  last_used_at TEXT,
  usage_count INTEGER DEFAULT 0,
  expires_at TEXT,
  revoked_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- Documents table (if not already exists)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  status TEXT DEFAULT 'pending',
  r2_key TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  processed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- ============================================
-- Email-specific views for analytics
-- ============================================

-- View: Recent email activity by template
CREATE VIEW IF NOT EXISTS v_email_activity AS
SELECT
  template,
  DATE(created_at) as date,
  COUNT(*) as total_sent,
  SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
  SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
  SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM email_logs
WHERE created_at >= datetime('now', '-30 days')
GROUP BY template, DATE(created_at)
ORDER BY date DESC, template;

-- View: Tenant email statistics
CREATE VIEW IF NOT EXISTS v_tenant_email_stats AS
SELECT
  tenant_id,
  COUNT(*) as total_emails,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
  SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
  SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced,
  MIN(created_at) as first_email,
  MAX(created_at) as last_email
FROM email_logs
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id;

-- ============================================
-- Sample Data (for development/testing)
-- ============================================

-- Uncomment to insert sample data for testing
/*
-- Sample tenant
INSERT OR IGNORE INTO tenants (id, name, slug, status, plan)
VALUES ('tenant-sample-001', 'Sample Organization', 'sample-org', 'active', 'premium');

-- Sample user
INSERT OR IGNORE INTO users (id, tenant_id, email, name, role, status)
VALUES ('user-sample-001', 'tenant-sample-001', 'admin@example.com', 'Admin User', 'admin', 'active');

-- Sample email logs
INSERT OR IGNORE INTO email_logs (id, tenant_id, to_address, subject, template, status, created_at)
VALUES
  ('email-001', 'tenant-sample-001', 'user@example.com', 'Welcome to KeyReply', 'welcome', 'sent', datetime('now', '-7 days')),
  ('email-002', 'tenant-sample-001', 'user@example.com', 'Password Reset Request', 'password-reset', 'sent', datetime('now', '-5 days')),
  ('email-003', 'tenant-sample-001', 'user@example.com', 'Document Ready', 'document-processed', 'sent', datetime('now', '-3 days')),
  ('email-004', 'tenant-sample-001', 'team@example.com', 'Join Our Team', 'invitation', 'sent', datetime('now', '-2 days')),
  ('email-005', 'tenant-sample-001', 'user@example.com', 'Daily Digest', 'notification-digest', 'sent', datetime('now', '-1 day'));
*/

-- ============================================
-- Migration Notes
-- ============================================

-- To apply this schema to your D1 database:
-- 1. wrangler d1 execute KEYREPLY_KIRA_DB --file=schema.sql
--
-- To create the database:
-- 1. wrangler d1 create KEYREPLY_KIRA_DB
--
-- To add to wrangler.toml:
-- [[d1_databases]]
-- binding = "DB"
-- database_name = "PPP_ACADEMY_DB"
-- database_id = "your-database-id"
--
-- To add Resend API key:
-- wrangler secret put RESEND_API_KEY
-- (Enter your Resend API key when prompted)
