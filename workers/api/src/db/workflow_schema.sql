-- Workflow Automation Schema
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'page_view', 'inbound_message', 'tag_added', 'custom_event'
  is_active BOOLEAN DEFAULT 1,
  definition TEXT, -- JSON: nodes and edges (React Flow format)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_run_at DATETIME,
  run_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant_active ON workflows(tenant_id, is_active);

-- Execution Logs
CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT,
  tenant_id TEXT,
  status TEXT, -- 'running', 'completed', 'failed'
  context TEXT, -- JSON input context
  result TEXT, -- JSON output/result
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error TEXT
);
