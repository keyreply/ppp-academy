/**
 * D1 Database Schema Types
 */

/**
 * Session table
 */
export interface DbSession {
  id: string;
  user_id: string;
  tenant_id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  last_activity: string;
  email: string;
  role: 'member' | 'admin' | 'owner';
  status: 'active' | 'inactive';
  permissions: string; // JSON string
}

/**
 * User table
 */
export interface DbUser {
  id: string;
  tenant_id: string;
  email: string;
  name: string | null;
  role: 'member' | 'admin' | 'owner';
  status: 'active' | 'inactive';
  permissions: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

/**
 * Campaign table
 */
export interface DbCampaign {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

/**
 * Document table
 */
export interface DbDocument {
  id: string;
  tenant_id: string;
  user_id: string | null;
  filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: string; // JSON string
  created_at: string;
  updated_at: string;
}

/**
 * API Key table
 */
export interface DbApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string; // JSON string
  created_by: string;
  last_used: number | null;
  expires_at: number | null;
  status: 'active' | 'revoked';
  created_at: string;
}

/**
 * Analytics event table
 */
export interface DbAnalyticsEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  category: string | null;
  label: string | null;
  value: number | null;
  occurred_at: string;
  metadata: string; // JSON string
}

/**
 * Email log table
 */
export interface DbEmailLog {
  id: string;
  tenant_id: string;
  to_email: string;
  subject: string;
  template: string | null;
  status: 'queued' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

/**
 * Workflow table
 */
export interface DbWorkflow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused';
  trigger_type: string;
  trigger_config: string; // JSON string
  nodes: string; // JSON string
  edges: string; // JSON string
  created_at: string;
  updated_at: string;
}

/**
 * Channel configuration table
 */
export interface DbChannel {
  id: string;
  tenant_id: string;
  type: 'email' | 'whatsapp' | 'sms' | 'phone';
  name: string;
  config: string; // JSON string
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

/**
 * D1 query result wrapper
 */
export interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
  };
}
