/**
 * Speech-to-Text (STT) Routes
 * Primary: Deepgram Nova 3 on Cloudflare Workers AI
 * Fallback: Cloudflare Whisper (free tier)
 */

import { Hono } from 'hono';
import {
  transcribeAudio,
  transcribeWithNova3,
  transcribeWithWhisper,
  STT_MODELS,
  DEFAULT_STT
} from '../services/ai-config.js';
import { authMiddleware, getUserId, getTenantId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * GET /stt/models
 * List available STT models
 */
app.get('/models', (c) => {
  return c.json({
    models: STT_MODELS,
    defaults: DEFAULT_STT,
    recommended: 'NOVA_3',
    providers: {
      cloudflare: {
        name: 'Cloudflare Workers AI',
        models: {
          'NOVA_3': {
            id: '@cf/deepgram/nova-3',
            description: 'Deepgram Nova 3 - Best quality, streaming support',
            cost: '$0.0052/min (HTTP), $0.0092/min (WebSocket)',
            recommended: true
          },
          'WHISPER': {
            id: '@cf/openai/whisper',
            description: 'OpenAI Whisper - Free tier, 30s max',
            cost: 'Free',
            recommended: false
          },
          'WHISPER_LARGE': {
            id: '@cf/openai/whisper-large-v3-turbo',
            description: 'Whisper Large V3 - Free, better accuracy',
            cost: 'Free',
            recommended: false
          }
        },
        features: ['no-external-api-key', 'unified-billing']
      }
    }
  });
});

/**
 * POST /stt/transcribe
 * Transcribe audio file using Nova 3 (default) or Whisper (free)
 *
 * Body: multipart/form-data with 'audio' file
 * Query params:
 *   - free_tier: use Whisper instead of Nova 3 (default: false)
 *   - language: language code (e.g., 'en', 'es')
 *   - detect_language: auto-detect language (default: true)
 */
app.post('/transcribe', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    // Get options from query params
    const freeTier = c.req.query('free_tier') === 'true';
    const language = c.req.query('language');
    const detectLanguage = c.req.query('detect_language') !== 'false';

    // Get audio data
    const audioData = await audioFile.arrayBuffer();

    // Build options
    const options = {
      freeTier,
      language,
      detectLanguage,
      mimeType: audioFile.type || 'audio/wav'
    };

    // Transcribe using default (Nova 3) or free tier (Whisper)
    const result = await transcribeAudio(c.env, audioData, options);

    // Track usage
    const tenantId = getTenantId(c);
    if (tenantId) {
      try {
        const tenantStub = c.env.TENANT.get(c.env.TENANT.idFromName(tenantId));
        await tenantStub.fetch(new Request('http://internal/track-usage', {
          method: 'POST',
          body: JSON.stringify({ metric: 'ai_queries', amount: 1 })
        }));
      } catch (e) {
        console.error('Failed to track STT usage:', e);
      }
    }

    return c.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return c.json({
      error: 'Transcription failed',
      message: error.message
    }, 500);
  }
});

/**
 * POST /stt/transcribe/nova3
 * Transcribe using Deepgram Nova 3 on Cloudflare (recommended)
 */
app.post('/transcribe/nova3', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    const audioData = await audioFile.arrayBuffer();

    const options = {
      language: c.req.query('language'),
      detectLanguage: c.req.query('detect_language') !== 'false'
    };

    const result = await transcribeWithNova3(c.env, audioData, options);

    return c.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Nova 3 transcription error:', error);
    return c.json({
      error: 'Transcription failed',
      message: error.message
    }, 500);
  }
});

/**
 * POST /stt/transcribe/whisper
 * Transcribe using Cloudflare Whisper (free tier)
 */
app.post('/transcribe/whisper', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    const audioData = await audioFile.arrayBuffer();
    const result = await transcribeWithWhisper(c.env, audioData);

    return c.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Whisper transcription error:', error);
    return c.json({
      error: 'Transcription failed',
      message: error.message
    }, 500);
  }
});

/**
 * GET /stt/status
 * Check STT service status and configuration
 */
app.get('/status', async (c) => {
  const aiAvailable = !!c.env.AI;

  return c.json({
    status: aiAvailable ? 'ok' : 'unavailable',
    models: {
      nova3: {
        id: '@cf/deepgram/nova-3',
        available: aiAvailable,
        recommended: true,
        cost: {
          http: '$0.0052/min',
          websocket: '$0.0092/min'
        },
        features: STT_MODELS.NOVA_3.features
      },
      whisper: {
        id: '@cf/openai/whisper',
        available: aiAvailable,
        recommended: false,
        cost: 'Free',
        limitations: ['30s max per request']
      },
      whisperLarge: {
        id: '@cf/openai/whisper-large-v3-turbo',
        available: aiAvailable,
        recommended: false,
        cost: 'Free',
        limitations: ['30s max per request']
      }
    },
    defaultModel: 'nova3',
    features: {
      batchTranscription: aiAvailable,
      streamingTranscription: aiAvailable,
      diarization: aiAvailable,
      languageDetection: aiAvailable,
      sentimentAnalysis: aiAvailable,
      entityExtraction: aiAvailable
    }
  });
});

export default app;
