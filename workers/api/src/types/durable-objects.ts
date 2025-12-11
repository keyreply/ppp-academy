/**
 * Durable Object State Types
 */

// ============================================
// TenantDO State Types
// ============================================

export interface TenantOrganization {
  id: number;
  tenant_id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface TenantSubscription {
  id: number;
  plan_tier: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired';
  billing_cycle: 'monthly' | 'annual';
  current_period_start: number | null;
  current_period_end: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface TenantUsage {
  id: number;
  api_calls: number;
  ai_queries: number;
  emails_sent: number;
  whatsapp_sent: number;
  storage_used_mb: number;
  last_reset: number;
  updated_at: number;
}

export interface TenantTeamMember {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: 'member' | 'admin' | 'owner';
  permissions: string | null;
  status: 'active' | 'inactive';
  joined_at: number;
  last_active: number | null;
}

export interface TenantInvitation {
  id: string;
  email: string;
  role: 'member' | 'admin';
  permissions: string | null;
  invited_by: string;
  expires_at: number;
  created_at: number;
}

export interface TenantApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions: string | null;
  created_by: string;
  expires_at: number | null;
  last_used: number | null;
  status: 'active' | 'revoked';
  created_at: number;
}

export interface TenantSettings {
  key: string;
  value: string;
  updated_at: number;
  updated_by: string | null;
}

export interface TenantFeatureFlag {
  feature_key: string;
  enabled: number;
  config: string | null;
  updated_at: number;
}

export interface TenantWebhook {
  id: string;
  url: string;
  events: string;
  secret: string | null;
  status: 'active' | 'inactive';
  created_at: number;
}

export interface TenantIntegration {
  id: string;
  provider: string;
  config: string;
  status: 'active' | 'inactive';
  created_at: number;
  updated_at: number;
}

// ============================================
// CustomerDO State Types
// ============================================

export interface CustomerProfile {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_id: string | null;
  company: string | null;
  title: string | null;
  status: 'active' | 'inactive';
  lead_score: number;
  tags: string; // JSON array
  custom_fields: string; // JSON object
  created_at: number;
  updated_at: number;
}

export interface CustomerMessage {
  id: string;
  channel: 'email' | 'whatsapp' | 'sms';
  direction: 'inbound' | 'outbound';
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body: string;
  html_body: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  attachments: string; // JSON array
  metadata: string; // JSON object
  created_at: number;
  sent_at: number | null;
  delivered_at: number | null;
  read_at: number | null;
}

export interface CustomerCall {
  id: string;
  direction: 'inbound' | 'outbound';
  from_number: string | null;
  to_number: string | null;
  status: 'initiated' | 'connected' | 'completed' | 'failed';
  duration: number;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  sentiment: string | null;
  key_points: string; // JSON array
  action_items: string; // JSON array
  metadata: string; // JSON object
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
}

export interface CustomerNote {
  id: string;
  content: string;
  type: 'general' | 'call' | 'meeting' | 'task';
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface CustomerTask {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date: number | null;
  assigned_to: string | null;
  created_by: string;
  created_at: number;
  completed_at: number | null;
}

export interface CustomerAIContext {
  id: string;
  summary: string | null;
  key_facts: string; // JSON array
  preferences: string; // JSON object
  pain_points: string; // JSON array
  goals: string; // JSON array
  relationship_notes: string | null;
  conversation_style: string | null;
  best_contact_time: string | null;
  response_urgency: 'low' | 'normal' | 'high' | null;
  escalation_triggers: string; // JSON array
  products_owned: string; // JSON array
  products_interested: string; // JSON array
  lifetime_value: number;
  risk_level: 'low' | 'medium' | 'high' | null;
  last_interaction_summary: string | null;
  sentiment_trend: 'improving' | 'stable' | 'declining' | null;
  engagement_level: 'low' | 'medium' | 'high' | null;
  updated_at: number;
}

// ============================================
// ConversationDO State Types
// ============================================

export interface ConversationRecord {
  id: string;
  tenant_id: string;
  customer_id: string;
  channel: 'email' | 'whatsapp' | 'sms';
  status: 'open' | 'closed' | 'archived';
  subject: string | null;
  assigned_to: string | null;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_id: string | null;
  content: string;
  attachments: string; // JSON array
  metadata: string; // JSON object
  created_at: number;
}

// ============================================
// CampaignDO State Types
// ============================================

export interface CampaignRecord {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  description: string | null;
  target_audience: string | null;
  schedule: string | null; // JSON object
  stats: string | null; // JSON object
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  customer_id: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'failed';
  sent_at: number | null;
  delivered_at: number | null;
  opened_at: number | null;
  clicked_at: number | null;
  replied_at: number | null;
}

// ============================================
// WorkflowDO State Types
// ============================================

export interface WorkflowRecord {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused';
  trigger_type: string;
  trigger_config: string; // JSON object
  nodes: string; // JSON array
  edges: string; // JSON array
  created_at: number;
  updated_at: number;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  trigger_data: string; // JSON object
  status: 'running' | 'completed' | 'failed';
  current_node: string | null;
  context: string; // JSON object
  started_at: number;
  completed_at: number | null;
  error: string | null;
}

// ============================================
// NotificationDO State Types
// ============================================

export interface NotificationRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: string | null; // JSON object
  read: number;
  created_at: number;
  read_at: number | null;
}

// ============================================
// AnalyticsDO State Types
// ============================================

export interface AnalyticsMetric {
  id: number;
  metric_key: string;
  metric_value: number;
  date: string;
  metadata: string | null; // JSON object
}

// ============================================
// AgentDO State Types
// ============================================

export interface AgentConfig {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  model: string;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
  tools: string; // JSON array
  knowledge_base_ids: string; // JSON array
  status: 'active' | 'inactive';
  created_at: number;
  updated_at: number;
}

// ============================================
// WebSocket Message Types
// ============================================

export interface WebSocketMessage<T = unknown> {
  type: string;
  data?: T;
  timestamp?: number;
}

export type TenantWSMessageType =
  | 'organization.updated'
  | 'subscription.updated'
  | 'usage.updated'
  | 'team.member_added'
  | 'team.member_updated'
  | 'team.member_removed'
  | 'invitation.created'
  | 'invitation.accepted'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'settings.updated'
  | 'feature_flag.updated'
  | 'webhook.created'
  | 'webhook.updated'
  | 'integration.created';

export type CustomerWSMessageType =
  | 'customer_data'
  | 'customer_updated'
  | 'message_sent'
  | 'message_received'
  | 'message_status_updated'
  | 'call_logged'
  | 'call_updated'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'ai_context_updated'
  | 'pong'
  | 'error';
