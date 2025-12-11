/**
 * Frontend Type Definitions
 */

// ============================================
// View Types
// ============================================

export type ViewType =
  | 'conversations'
  | 'dashboard'
  | 'preview'
  | 'brands'
  | 'channels'
  | 'knowledge'
  | 'campaigns'
  | 'workflows'
  | 'testing'
  | 'widget'
  | 'settings'
  | 'contacts'
  | 'logo-demo';

export type InteractionMode = 'interactive' | 'demo';

export type ActivePanel = 'profile' | 'logs';

export type PreviewMode = 'kira' | 'user';

// ============================================
// Avatar Types
// ============================================

export interface Avatar {
  bg: string;
  initials: string;
}

// ============================================
// Conversation Types
// ============================================

export type MessageType = 'kira' | 'user' | 'system';

export type OptionType = 'positive' | 'negative' | 'neutral';

export interface MessageOption {
  text: string;
  type: OptionType;
}

export interface VoiceContent {
  title: string;
  duration: string;
  audioSrc: string;
  transcript: string;
}

export interface ConversationStep {
  type: MessageType;
  content: string;
  time: string;
  options?: MessageOption[];
  trigger?: string;
  hasVoice?: boolean;
  voiceContent?: VoiceContent;
}

export interface Message {
  id?: string;
  type: MessageType;
  content: string;
  timestamp?: string;
  time?: string;
  hasVoice?: boolean;
  voiceContent?: VoiceContent;
  options?: MessageOption[];
}

export interface TagTooltip {
  title: string;
  description: string;
}

export interface ConversationTag {
  name: string;
  type: string;
  icon: string;
  tooltip: TagTooltip;
}

export interface ActivityLog {
  time: string;
  title: string;
  detail: string;
  code?: string;
}

export interface ConversationStatus {
  intent: string;
  nextAction: string;
  queue: string;
}

export interface Conversation {
  id: number;
  name: string;
  title: string;
  avatar: Avatar;
  statusBadge: string;
  day: number;
  preview: string;
  status: 'open' | 'closed' | 'archived';
  channel: string;
  timeAgo: string;
  unreadCount: number;
  steps: ConversationStep[];
  messages?: Message[];
  tags?: ConversationTag[];
  logs?: ActivityLog[];
  currentStatus?: ConversationStatus;
}

// ============================================
// Contact Types
// ============================================

export interface Contact {
  id: number;
  name: string;
  channel: string;
  domain: string;
  type: string;
  lastSeen: string;
  firstSeen: string;
  signedUp: string;
  webSessions: number;
  avatar: Avatar;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
}

// ============================================
// Task Types
// ============================================

export type TaskStatus = 'Draft' | 'Pending Review' | 'In Progress' | 'Completed' | 'Rejected';

export type StartType = 'Immediate' | 'Scheduled';

export interface Task {
  id: number;
  taskName: string;
  targetCount: number;
  template: string;
  startType: StartType;
  creator: string;
  createdAt: string;
  status: TaskStatus;
  isOpen: boolean;
  startTime?: string;
  rejectionReason?: string;
}

export interface Template {
  id: number;
  name: string;
  disc: string;
}

export interface UserTagChild {
  label: string;
  count: number;
}

export interface UserTagCategory {
  label: string;
  children?: UserTagChild[];
  count?: number;
}

export interface CallResult {
  id: number;
  userName: string;
  phone: string;
  userTags: string[];
  voiceFile: string;
  transcript: string;
  duration: string;
  result: string;
}

export interface StatusOption {
  value: string;
  label: string;
}

// ============================================
// Knowledge Base Types
// ============================================

export type ArticleType = 'article' | 'faq' | 'snippet';

export type ArticleLanguage = 'en' | 'zh' | 'id';

export interface Article {
  id: number;
  title: string;
  type: ArticleType;
  language: ArticleLanguage;
  created: string;
  createdBy: string;
  lastUpdated: string;
  lastUpdatedBy: string;
  finEnabled: boolean;
  copilotEnabled: boolean;
  audience: string;
  tags: string[];
  folder: string;
  content: string;
}

export interface KnowledgeFolder {
  id: number;
  name: string;
  articles: Article[];
}

export type SourceStatus = 'synced' | 'pending' | 'error';

export interface KnowledgeSource {
  id: number;
  name: string;
  icon: string;
  articleCount: number;
  status: SourceStatus;
  description: string;
}

export type IntegrationStatus = 'Connected' | 'Not Connected' | 'Pending';

export interface Integration {
  id: number;
  name: string;
  icon: string;
  type?: string;
  articleCount?: number;
  status: IntegrationStatus;
  description: string;
  subtitle?: string;
  integration?: string;
  scope?: string;
}

// ============================================
// Campaign Types
// ============================================

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed';

export type CampaignType = 'email' | 'whatsapp' | 'sms' | 'multi-channel';

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  targetAudience?: string;
  stats?: CampaignStats;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================
// Workflow Types
// ============================================

export type WorkflowStatus = 'draft' | 'active' | 'paused';

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

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// Brand Types
// ============================================

export interface Brand {
  id: string;
  name: string;
  agent: string;
  defaultAddress: string;
  status: 'Active' | 'Inactive';
  iconColor: string;
  email?: string;
  phone?: string;
  isNew?: boolean;
}

// ============================================
// Channel Types
// ============================================

export type ChannelType = 'email' | 'whatsapp' | 'sms' | 'phone';

export interface ChannelConfig {
  // Email
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  fromEmail?: string;
  fromName?: string;

  // WhatsApp
  phoneNumberId?: string;
  accessToken?: string;

  // SMS/Phone
  twilioAccountSid?: string;
  twilioPhoneNumber?: string;
}

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  status: 'active' | 'inactive';
  config: ChannelConfig;
}

// ============================================
// Dashboard/Analytics Types
// ============================================

export interface DashboardSummary {
  totalConversations: number;
  interestedLeads: number;
  voiceInteractions: number;
  declined: number;
}

export interface FunnelStep {
  name: string;
  value: number;
  percentage: number;
}

export interface IntentData {
  name: string;
  value: number;
  color: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================
// Preview Message Types
// ============================================

export interface PreviewMessage {
  sender: 'kira' | 'user';
  content: string;
}

// ============================================
// Component Prop Types (commonly shared)
// ============================================

export interface SetStateAction<T> {
  (value: T | ((prev: T) => T)): void;
}
