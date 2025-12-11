/**
 * Voice API Routes
 *
 * Proxies voice-related requests to the Voice Worker service.
 * This enables centralized API access while allowing the Voice Worker
 * to scale independently for high-concurrency voice sessions.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/context.ts';

const voice = new Hono<HonoEnv>();

/**
 * Proxy all voice requests to the Voice Worker
 *
 * The Voice Worker handles:
 * - POST /api/sessions - Initialize voice session
 * - GET /api/sessions - List active sessions
 * - GET /session/:sessionId - Get session state
 * - POST /session/:sessionId/message - Send text message
 * - PATCH /session/:sessionId/lead - Update lead info
 * - POST /session/:sessionId/end - End session
 * - WebSocket /ws/:sessionId - Real-time voice streaming
 */
voice.all('/*', async (c) => {
  const env = c.env;

  if (!env.VOICE_SERVICE) {
    return c.json({ error: 'Voice service not configured' }, 503);
  }

  // Get the path after /voice
  const url = new URL(c.req.url);
  const voicePath = url.pathname.replace(/^\/api\/v1\/voice/, '');

  // Build the request to forward to voice worker
  const targetUrl = new URL(voicePath || '/', 'https://voice-worker');
  targetUrl.search = url.search;

  // Forward headers, including WebSocket upgrade headers
  const headers = new Headers(c.req.raw.headers);

  // Add tenant context if available
  const tenantId = c.get('tenantId');
  if (tenantId) {
    headers.set('X-Tenant-ID', tenantId);
  }

  try {
    // Use the service binding to call the voice worker
    const response = await env.VOICE_SERVICE.fetch(targetUrl.toString(), {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD'
        ? c.req.raw.body
        : undefined,
    });

    // Return the response from voice worker
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Voice service error:', error);
    return c.json({
      error: 'Voice service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 503);
  }
});

export default voice;
