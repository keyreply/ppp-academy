/**
 * API Request/Response Types
 */

// ============================================
// Generic Response Wrapper
// ============================================

export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// ============================================
// Tenant Endpoints
// ============================================

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  domain?: string;
  logo_url?: string;
  user_id: string;
}

export interface CreateInvitationRequest {
  email: string;
  role?: 'member' | 'admin';
  permissions?: string[];
  invited_by: string;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions?: string[];
  expires_at?: number;
  created_by: string;
}

export interface UpdateSettingsRequest {
  key: string;
  value: unknown;
  updated_by: string;
}

// ============================================
// Customer Endpoints
// ============================================

export interface CreateCustomerRequest {
  name: string;
  email?: string;
  phone?: string;
  whatsapp_id?: string;
  company?: string;
  title?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  created_by: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  status?: 'active' | 'inactive';
  lead_score?: number;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  updated_by: string;
}

// ============================================
// Conversation Endpoints
// ============================================

export interface SendMessageRequest {
  body: string;
  channel?: 'email' | 'whatsapp' | 'sms';
  sentBy: string;
  attachments?: string[];
}

export interface CreateConversationRequest {
  customerId: string;
  channel: 'email' | 'whatsapp' | 'sms';
  subject?: string;
  initialMessage?: string;
  createdBy: string;
}

// ============================================
// Campaign Endpoints
// ============================================

export interface CreateCampaignRequest {
  name: string;
  type: string;
  description?: string;
  target_audience?: string;
  schedule?: CampaignSchedule;
}

export interface CampaignSchedule {
  start_date?: string;
  end_date?: string;
  time_zone?: string;
  send_times?: string[];
}

export interface CampaignActionRequest {
  action: 'start' | 'pause' | 'resume' | 'stop';
}

// ============================================
// Workflow Endpoints
// ============================================

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused';
  trigger_type?: string;
  trigger_config?: Record<string, unknown>;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// ============================================
// Document Endpoints
// ============================================

export interface UploadDocumentRequest {
  filename: string;
  mime_type: string;
  file_size: number;
}

export interface DocumentStatsResponse {
  total_documents: number;
  total_size_mb: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

// ============================================
// Chat/RAG Endpoints
// ============================================

export interface ChatRequest {
  message: string;
  context?: string;
  conversation_id?: string;
  stream?: boolean;
}

export interface ChatResponse {
  response: string;
  sources?: ChatSource[];
  conversation_id?: string;
}

export interface ChatSource {
  document_id: string;
  chunk_index: number;
  text: string;
  score: number;
}

// ============================================
// Analytics Endpoints
// ============================================

export interface AnalyticsQueryParams {
  start_date?: string;
  end_date?: string;
  event_type?: string;
  category?: string;
  group_by?: 'day' | 'week' | 'month';
}

export interface AnalyticsSummary {
  total_conversations: number;
  interested_leads: number;
  voice_interactions: number;
  declined: number;
  conversion_rate: number;
}

// ============================================
// Channel Endpoints
// ============================================

export interface UpdateChannelRequest {
  name?: string;
  config?: ChannelConfig;
  status?: 'active' | 'inactive';
}

export interface ChannelConfig {
  // Email
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  from_email?: string;
  from_name?: string;

  // WhatsApp
  phone_number_id?: string;
  access_token?: string;
  webhook_verify_token?: string;

  // SMS
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;

  // Phone
  provider?: string;
  api_key?: string;
}

// ============================================
// Email Endpoints
// ============================================

export interface SendEmailRequest {
  to: string;
  subject: string;
  template?: string;
  html?: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Platform Function Endpoints
// ============================================

export interface PlatformFunctionMetadata {
  created_at: number;
  updated_at: number;
  description?: string;
  tags?: string[];
  created_by?: string;
}

export interface PlatformFunction {
  name: string;
  script: string;
  metadata: PlatformFunctionMetadata;
}

export interface UpdateFunctionRequest {
  script: string;
  metadata?: Partial<PlatformFunctionMetadata>;
}
