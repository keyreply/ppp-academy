/**
 * KeyReply Kira AI API Client
 * Centralized client for communicating with the backend API.
 */

import type {
  ApiResponse,
  Campaign,
  Contact,
  Workflow,
  Channel,
} from '../types/index.ts';

// Determine API URL based on environment
// In production (Cloudflare Pages), use the custom domain with /v1 namespace
// In development, use localhost
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://kira.keyreply.com/v1'
    : 'http://localhost:8787');

// Request options type
interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Document types
interface Document {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

interface DocumentStats {
  total_documents: number;
  total_size_mb: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

// Chat types
type KnowledgeSource = 'user' | 'self' | 'all';

interface ChatResponse {
  response: string;
  sources?: Array<{
    documentName: string;
    score: number;
    preview: string;
  }>;
  hasContext?: boolean;
  searchQuery?: string;
  knowledgeSource?: KnowledgeSource;
}

// Auth types
interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        this.clearToken();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('Unauthorized');
      }

      // Parse JSON if content-type is json
      const contentType = response.headers.get('content-type');
      let data: T | string;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorData = data as { error?: string; message?: string };
        throw new Error(errorData.error || errorData.message || 'API request failed');
      }

      return data as T;

    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // HTTP Methods
  get<T = unknown>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T = unknown>(endpoint: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
      body: formData
    });
    return response.json();
  }

  // ==========================================
  // Domain Specific Methods
  // ==========================================

  /* Documents / Knowledge Base */
  documents = {
    list: (): Promise<{ documents: Document[] }> => this.get('/documents'),
    get: (id: string): Promise<Document> => this.get(`/documents/${id}`),
    upload: (file: File): Promise<{ document: Document }> => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
        body: formData
      }).then(res => res.json());
    },
    delete: (id: string): Promise<{ success: boolean }> => this.delete(`/documents/${id}`),
    stats: (): Promise<DocumentStats> => this.get('/documents/stats/summary')
  };

  /* Chat / RAG */
  chat = {
    /**
     * Send a chat message with RAG
     * @param prompt - The user's question
     * @param context - Current page context
     * @param useThinking - Enable thinking mode
     * @param knowledgeSource - 'user' (your docs), 'self' (Kira docs), or 'all' (both)
     */
    send: (
      prompt: string,
      context?: string,
      useThinking = false,
      knowledgeSource: KnowledgeSource = 'user'
    ): Promise<ChatResponse> =>
      this.post('/chat', { prompt, context, useThinking, knowledgeSource }),

    /**
     * Search Kira's self-documentation
     */
    searchSelfDocs: (query: string): Promise<ChatResponse> =>
      this.post('/chat', { prompt: query, knowledgeSource: 'self' }),

    /**
     * Search all knowledge sources (user docs + Kira docs)
     */
    searchAll: (prompt: string, context?: string): Promise<ChatResponse> =>
      this.post('/chat', { prompt, context, knowledgeSource: 'all' })
  };

  /* Conversations / Chat */
  conversations = {
    list: (): Promise<{ conversations: unknown[] }> => this.get('/conversations'),
    get: (id: string): Promise<unknown> => this.get(`/conversations/${id}`),
    getMessages: (id: string, params?: Record<string, string>): Promise<{ messages: unknown[] }> =>
      this.get(`/conversations/${id}/messages`, params),
    sendMessage: (id: string, content: string): Promise<{ message: unknown }> =>
      this.post(`/conversations/${id}/messages`, { content }),
    create: (data: unknown): Promise<{ conversation: unknown }> => this.post('/conversations', data),
    askRAG: (prompt: string, context?: string): Promise<ChatResponse> =>
      this.post('/chat', { prompt, context })
  };

  /* Customers */
  customers = {
    list: (params?: Record<string, string>): Promise<{ customers: Contact[] }> =>
      this.get('/customers', params),
    get: (id: string): Promise<Contact> => this.get(`/customers/${id}`),
    create: (data: Partial<Contact>): Promise<{ customer: Contact }> => this.post('/customers', data),
    update: (id: string, data: Partial<Contact>): Promise<{ customer: Contact }> =>
      this.put(`/customers/${id}`, data),
    delete: (id: string): Promise<{ success: boolean }> => this.delete(`/customers/${id}`)
  };

  /* Campaigns */
  campaigns = {
    list: (): Promise<{ campaigns: Campaign[] }> => this.get('/campaigns'),
    get: (id: string): Promise<Campaign> => this.get(`/campaigns/${id}`),
    create: (data: Partial<Campaign>): Promise<{ campaign: Campaign }> => this.post('/campaigns', data),
    start: (id: string): Promise<{ success: boolean }> =>
      this.post(`/campaigns/${id}/action`, { action: 'start' }),
    pause: (id: string): Promise<{ success: boolean }> =>
      this.post(`/campaigns/${id}/action`, { action: 'pause' }),
    status: (id: string): Promise<{ status: string }> => this.get(`/campaigns/${id}/status`)
  };

  /* Workflows */
  workflows = {
    list: (): Promise<{ workflows: Workflow[] }> => this.get('/workflows'),
    get: (id: string): Promise<{ workflow: Workflow & { trigger_type?: string; is_active?: boolean; definition?: { nodes: unknown[]; edges: unknown[] } } }> =>
      this.get(`/workflows/${id}`),
    create: (data: Partial<Workflow>): Promise<{ workflow: Workflow }> => this.post('/workflows', data),
    update: (id: string, data: Partial<Workflow>): Promise<{ workflow: Workflow }> =>
      this.put(`/workflows/${id}`, data),
    test: (id: string): Promise<{ success: boolean; result?: unknown }> =>
      this.post(`/workflows/${id}/test`, {})
  };

  /* Channels */
  channels = {
    list: (): Promise<{ channels: Channel[] }> => this.get('/channels'),
    update: (type: string, data: Partial<Channel>): Promise<{ channel: Channel }> =>
      this.put(`/channels/${type}`, data)
  };

  /* Auth */
  auth = {
    login: (credentials: LoginCredentials): Promise<{ token: string; user: AuthUser }> =>
      this.post('/auth/login', credentials),
    register: (data: RegisterData): Promise<{ token: string; user: AuthUser }> =>
      this.post('/auth/register', data),
    logout: (): Promise<{ success: boolean }> => this.post('/auth/logout', {}),
    me: (): Promise<AuthUser> => this.get('/auth/me')
  };

  /* Platform Functions */
  functions = {
    list: (): Promise<{ success: boolean; data: Array<{ name: string; created_on: string }> }> =>
      this.get('/functions'),
    upload: (name: string, script: string): Promise<{ success: boolean; message: string }> =>
      this.post('/functions', { name, script }),
    delete: (name: string): Promise<{ success: boolean; message: string }> =>
      this.delete(`/functions/${name}`),
    execute: (name: string, payload: unknown): Promise<{ success: boolean; result: unknown }> =>
      this.post(`/functions/${name}/execute`, payload),
    generateCode: (data: {
      prompt: string;
      existingCode?: string;
      context?: {
        functionName?: string;
        description?: string;
        inputVariables?: string[];
        outputVariables?: string[];
      };
    }): Promise<{ success: boolean; code?: string; error?: string }> =>
      this.post('/functions/generate', data)
  };
}

export const api = new ApiClient();
