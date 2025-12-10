/**
 * Authentication and Authorization Middleware
 * Handles session validation, permission checking, and activity tracking
 */

/**
 * Main authentication middleware
 * Validates session from Authorization header and sets user context
 */
export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  let sessionToken;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionToken = authHeader.substring(7);
  } else {
    // Check for token in query params (useful for WebSockets)
    const url = new URL(c.req.url);
    sessionToken = url.searchParams.get('token');
  }

  if (!sessionToken) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization credentials' }, 401);
  }

  try {
    // Query D1 for session validation
    const session = await c.env.DB.prepare(
      `SELECT s.id, s.user_id, s.tenant_id, s.expires_at, s.last_activity,
              u.email, u.role, u.status, u.permissions
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND s.revoked_at IS NULL`
    )
      .bind(sessionToken)
      .first();

    if (!session) {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired session' }, 401);
    }

    // Check if user is active
    if (session.status !== 'active') {
      return c.json({ error: 'Forbidden', message: 'User account is not active' }, 403);
    }

    // Parse permissions
    const permissions = session.permissions ? JSON.parse(session.permissions) : [];

    // Set context variables
    c.set('user', {
      id: session.user_id,
      email: session.email,
      role: session.role,
      status: session.status,
      permissions: permissions
    });
    c.set('userId', session.user_id);
    c.set('tenantId', session.tenant_id);
    c.set('role', session.role);
    c.set('permissions', permissions);
    c.set('sessionId', session.id);

    // Update session last activity
    await c.env.DB.prepare(
      'UPDATE sessions SET last_activity = datetime(\'now\') WHERE id = ?'
    )
      .bind(session.id)
      .run();

    // Update member activity in TenantDO (async, non-blocking)
    try {
      const tenantStub = c.env.TENANT.get(
        c.env.TENANT.idFromName(session.tenant_id)
      );
      c.executionCtx.waitUntil(
        tenantStub.fetch('http://internal/members/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user_id,
            timestamp: new Date().toISOString()
          })
        })
      );
    } catch (err) {
      console.error('Failed to update member activity:', err);
    }

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Internal Server Error', message: 'Authentication failed' }, 500);
  }
}

/**
 * Get user ID from context
 */
export function getUserId(c) {
  return c.get('userId');
}

/**
 * Get tenant ID from context
 */
export function getTenantId(c) {
  return c.get('tenantId');
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(c, permission) {
  const permissions = c.get('permissions') || [];
  const role = c.get('role');

  // Admin has all permissions
  if (role === 'admin' || role === 'owner') {
    return true;
  }

  // Check if permission exists in user's permissions array
  return permissions.includes(permission) || permissions.includes('*');
}

/**
 * Middleware factory to require specific permission
 * Returns 403 if user doesn't have the permission
 */
export function requirePermission(permission) {
  return async (c, next) => {
    if (!hasPermission(c, permission)) {
      return c.json({
        error: 'Forbidden',
        message: `Missing required permission: ${permission}`
      }, 403);
    }
    await next();
  };
}

/**
 * Track API usage for quota management
 * Increments usage counters in TenantDO
 */
export async function trackApiUsage(c, next) {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const path = c.req.path;
  const method = c.req.method;

  // Track the request start time
  const startTime = Date.now();

  // Continue with the request
  await next();

  // Calculate request duration
  const duration = Date.now() - startTime;

  // Track usage asynchronously (non-blocking)
  if (tenantId) {
    try {
      const tenantStub = c.env.TENANT.get(
        c.env.TENANT.idFromName(tenantId)
      );

      c.executionCtx.waitUntil(
        tenantStub.fetch('http://internal/usage/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            path,
            method,
            duration,
            timestamp: new Date().toISOString(),
            statusCode: c.res.status
          })
        })
      );
    } catch (err) {
      console.error('Failed to track API usage:', err);
    }
  }
}

/**
 * Optional authentication middleware
 * Validates session if present but doesn't block if missing
 */
export async function optionalAuth(c, next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);

    try {
      const session = await c.env.DB.prepare(
        `SELECT s.id, s.user_id, s.tenant_id, u.email, u.role, u.permissions
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now') AND s.revoked_at IS NULL`
      )
        .bind(sessionToken)
        .first();

      if (session) {
        const permissions = session.permissions ? JSON.parse(session.permissions) : [];
        c.set('user', {
          id: session.user_id,
          email: session.email,
          role: session.role,
          permissions: permissions
        });
        c.set('userId', session.user_id);
        c.set('tenantId', session.tenant_id);
        c.set('role', session.role);
        c.set('permissions', permissions);
      }
    } catch (error) {
      console.error('Optional auth error:', error);
    }
  }

  await next();
}

/**
 * API key authentication middleware
 * Validates API key from X-API-Key header
 */
export async function apiKeyAuth(c, next) {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json({ error: 'Unauthorized', message: 'Missing API key' }, 401);
  }

  try {
    const keyData = await c.env.DB.prepare(
      `SELECT k.id, k.tenant_id, k.name, k.permissions, k.rate_limit, k.last_used_at,
              t.status as tenant_status
       FROM api_keys k
       JOIN tenants t ON k.tenant_id = t.id
       WHERE k.key_hash = ? AND k.revoked_at IS NULL AND k.expires_at > datetime('now')`
    )
      .bind(await hashApiKey(apiKey))
      .first();

    if (!keyData) {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired API key' }, 401);
    }

    if (keyData.tenant_status !== 'active') {
      return c.json({ error: 'Forbidden', message: 'Tenant account is not active' }, 403);
    }

    // Parse permissions
    const permissions = keyData.permissions ? JSON.parse(keyData.permissions) : [];

    // Set context variables
    c.set('apiKeyId', keyData.id);
    c.set('tenantId', keyData.tenant_id);
    c.set('permissions', permissions);
    c.set('authType', 'api_key');
    c.set('rateLimit', keyData.rate_limit);

    // Update last used timestamp
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        'UPDATE api_keys SET last_used_at = datetime(\'now\'), usage_count = usage_count + 1 WHERE id = ?'
      )
        .bind(keyData.id)
        .run()
    );

    await next();
  } catch (error) {
    console.error('API key auth error:', error);
    return c.json({ error: 'Internal Server Error', message: 'Authentication failed' }, 500);
  }
}

/**
 * Hash API key for storage/comparison
 */
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Rate limiting middleware
 * Uses RateLimiterDO to enforce rate limits
 */
export async function rateLimiter(limit = 100, windowMs = 60000) {
  return async (c, next) => {
    const tenantId = getTenantId(c);
    const userId = getUserId(c) || c.get('apiKeyId');

    if (!tenantId || !userId) {
      return await next();
    }

    try {
      const rateLimiterId = `${tenantId}:${userId}`;
      const limiterStub = c.env.RATE_LIMITER.get(
        c.env.RATE_LIMITER.idFromName(rateLimiterId)
      );

      const response = await limiterStub.fetch('http://internal/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, windowMs })
      });

      const result = await response.json();

      if (!result.allowed) {
        return c.json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter
        }, 429);
      }

      // Add rate limit headers
      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.resetAt.toString());

      await next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Continue on error to avoid blocking requests
      await next();
    }
  };
}
