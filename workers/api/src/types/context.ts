/**
 * Hono Context Types
 */

import type { WorkerEnv } from './env.ts';

/**
 * Authenticated user information stored in context variables
 */
export interface AuthUser {
  id: string;
  email: string;
  role: 'member' | 'admin' | 'owner';
  status: 'active' | 'inactive';
  permissions: string[];
}

/**
 * Context variables set by middleware
 */
export interface ContextVariables {
  user?: AuthUser;
  userId?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
  sessionId?: string;
  apiKeyId?: string;
  authType?: 'session' | 'api_key';
  rateLimit?: number;
}

/**
 * Hono environment type for typed context
 */
export interface HonoEnv {
  Bindings: WorkerEnv;
  Variables: ContextVariables;
}
