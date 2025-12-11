-- Channels Settings Table
-- Stores configuration for various communication channels (Email, SMS, WhatsApp, Phone)
CREATE TABLE channel_settings (
  tenant_id TEXT NOT NULL,
  channel_type TEXT NOT NULL, -- 'email', 'sms', 'whatsapp', 'phone'
  is_enabled BOOLEAN DEFAULT FALSE,
  credentials TEXT, -- JSON string for secure credentials (API keys, secrets)
  config TEXT, -- JSON string for public configuration (from address, phone numbers, profile info)
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, channel_type)
);

CREATE INDEX idx_channel_settings_tenant ON channel_settings(tenant_id);
