-- Campaign Management Schema
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'voice', 'email', 'whatsapp'
  channel_config TEXT, -- JSON: template_id, script_id, api_key_ref
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'running', 'paused', 'completed', 'archived'
  schedule_config TEXT, -- JSON: start_time, end_time, days_of_week, timezone
  compliance_config TEXT, -- JSON: max_concurrency, dnc_list_id, retry_attempts
  stats TEXT, -- JSON: total, pending, sent, delivered, failed, response_rate (cache)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT -- user_id
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status);

CREATE TABLE IF NOT EXISTS campaign_audiences (
  campaign_id TEXT,
  customer_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'sent', 'delivered', 'failed', 'replied'
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  metadata TEXT, -- JSON: specific merge variables for this customer
  error_message TEXT,
  PRIMARY KEY (campaign_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_audiences_status ON campaign_audiences(campaign_id, status);
