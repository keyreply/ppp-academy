-- Email logs table (for tracking and debugging)
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  to_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, delivered, bounced, queued
  resend_id TEXT,
  error_message TEXT,
  metadata TEXT, -- JSON string for template variables
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_id ON email_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);

-- Password Resets table
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
