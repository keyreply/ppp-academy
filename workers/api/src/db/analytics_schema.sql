-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- e.g., 'conversation_started', 'message_sent', 'intent_detected'
  category TEXT,            -- e.g., 'engagement', 'conversion', 'system'
  label TEXT,               -- e.g., 'positive', 'negative', 'product_interest'
  value REAL,               -- Numeric value if applicable (e.g., duration, score)
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT             -- JSON string for extra details
);

-- Indexes for efficient querying/reporting
CREATE INDEX IF NOT EXISTS idx_analytics_tenant_date ON analytics_events(tenant_id, occurred_at);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_label ON analytics_events(label);
