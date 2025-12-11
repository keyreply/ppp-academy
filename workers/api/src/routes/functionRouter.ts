import { Hono } from 'hono';
import { PlatformFunctionService } from '../services/PlatformFunctionService.ts';
import type { HonoEnv } from '../types/context.ts';

const functionRouter = new Hono<HonoEnv>();

// Helper to get service
const getService = (c: any) => new PlatformFunctionService(c.env);

// Upload/Update a function
functionRouter.post('/', async (c) => {
    const tenantId = c.req.header('X-Tenant-ID');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    const body = await c.req.json() as { name: string; script: string };
    if (!body.name || !body.script) {
        return c.json({ error: 'Name and script are required' }, 400);
    }

    try {
        const service = getService(c);
        await service.uploadFunction(tenantId, body.name, body.script);
        return c.json({ success: true, message: 'Function uploaded successfully' });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Delete a function
functionRouter.delete('/:name', async (c) => {
    const tenantId = c.req.header('X-Tenant-ID');
    const name = c.req.param('name');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    try {
        const service = getService(c);
        await service.deleteFunction(tenantId, name);
        return c.json({ success: true, message: 'Function deleted successfully' });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Execute a function (Test)
functionRouter.post('/:name/execute', async (c) => {
    const tenantId = c.req.header('X-Tenant-ID');
    const name = c.req.param('name');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    const payload = await c.req.json();

    try {
        const service = getService(c);
        const result = await service.executeFunction(tenantId, name, payload);
        return c.json({ success: true, result });
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// List functions
functionRouter.get('/', async (c) => {
    const tenantId = c.req.header('X-Tenant-ID');
    if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

    try {
        const service = getService(c);
        const functions = await service.listFunctions(tenantId);
        return c.json({ success: true, data: functions });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Generate function code using AI
functionRouter.post('/generate', async (c) => {
    const body = await c.req.json() as {
        prompt: string;
        existingCode?: string;
        context?: {
            functionName?: string;
            description?: string;
            inputVariables?: string[];
            outputVariables?: string[];
        };
    };

    if (!body.prompt) {
        return c.json({ error: 'Prompt is required' }, 400);
    }

    const systemPrompt = `You are an expert JavaScript/TypeScript developer creating Cloudflare Worker functions.
These functions run in the run_code step of a workflow automation system.

FUNCTION CONTRACT:
- Functions receive an input object with user-mapped variables plus a __context object
- The __context contains: workflowId, executionId, customerId, customer (profile), variables (all workflow vars), triggerEvent, triggerData
- Functions should return a value that will be stored in the outputVariable
- To set multiple workflow variables, return { __variables: { key1: value1, key2: value2 } }

AVAILABLE GLOBALS:
- fetch() for HTTP requests
- console.log() for debugging
- crypto for cryptographic operations
- JSON, Date, Math, etc.

CONSTRAINTS:
- No file system access
- No eval or dynamic imports
- Must be pure JavaScript/TypeScript
- Must handle errors gracefully
- Should complete within 10 seconds

RESPONSE FORMAT:
Return ONLY the JavaScript code without any markdown formatting, code fences, or explanations.
The code should be a complete async default export function.

Example structure:
export default async function handler(input) {
  const { __context, ...userInput } = input;
  // Your logic here
  return result;
}`;

    const userPrompt = body.existingCode
        ? `Modify the following function based on this request: "${body.prompt}"

Existing code:
${body.existingCode}

${body.context ? `Context:
- Function name: ${body.context.functionName || 'unnamed'}
- Description: ${body.context.description || 'No description'}
- Expected inputs: ${body.context.inputVariables?.join(', ') || 'None specified'}
- Expected outputs: ${body.context.outputVariables?.join(', ') || 'None specified'}` : ''}`
        : `Create a function based on this request: "${body.prompt}"

${body.context ? `Context:
- Function name: ${body.context.functionName || 'unnamed'}
- Description: ${body.context.description || 'No description'}
- Expected inputs: ${body.context.inputVariables?.join(', ') || 'None specified'}
- Expected outputs: ${body.context.outputVariables?.join(', ') || 'None specified'}` : ''}`;

    try {
        const response = await c.env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 2048,
            temperature: 0.3,
        });

        // Extract generated code, handling potential thinking tags
        let generatedCode = (response as { response: string }).response || '';

        // Remove thinking tags if present (Qwen3 may include <think>...</think>)
        generatedCode = generatedCode.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // Remove any markdown code fences if the model added them
        generatedCode = generatedCode.replace(/^```(?:javascript|typescript|js|ts)?\n?/i, '');
        generatedCode = generatedCode.replace(/\n?```$/i, '');
        generatedCode = generatedCode.trim();

        return c.json({
            success: true,
            code: generatedCode,
        });
    } catch (err: any) {
        console.error('AI code generation error:', err);
        return c.json({ error: 'Failed to generate code', details: err.message }, 500);
    }
});

// Stream-based AI code generation
functionRouter.post('/generate/stream', async (c) => {
    const body = await c.req.json() as {
        prompt: string;
        existingCode?: string;
        context?: {
            functionName?: string;
            description?: string;
            inputVariables?: string[];
            outputVariables?: string[];
        };
    };

    if (!body.prompt) {
        return c.json({ error: 'Prompt is required' }, 400);
    }

    const systemPrompt = `You are an expert JavaScript/TypeScript developer creating Cloudflare Worker functions.
These functions run in the run_code step of a workflow automation system.

FUNCTION CONTRACT:
- Functions receive an input object with user-mapped variables plus a __context object
- The __context contains: workflowId, executionId, customerId, customer (profile), variables (all workflow vars), triggerEvent, triggerData
- Functions should return a value that will be stored in the outputVariable
- To set multiple workflow variables, return { __variables: { key1: value1, key2: value2 } }

AVAILABLE GLOBALS:
- fetch() for HTTP requests
- console.log() for debugging
- crypto for cryptographic operations
- JSON, Date, Math, etc.

CONSTRAINTS:
- No file system access
- No eval or dynamic imports
- Must be pure JavaScript/TypeScript
- Must handle errors gracefully
- Should complete within 10 seconds

RESPONSE FORMAT:
Return ONLY the JavaScript code without any markdown formatting, code fences, or explanations.
The code should be a complete async default export function.

Example structure:
export default async function handler(input) {
  const { __context, ...userInput } = input;
  // Your logic here
  return result;
}`;

    const userPrompt = body.existingCode
        ? `Modify the following function based on this request: "${body.prompt}"

Existing code:
${body.existingCode}

${body.context ? `Context:
- Function name: ${body.context.functionName || 'unnamed'}
- Description: ${body.context.description || 'No description'}
- Expected inputs: ${body.context.inputVariables?.join(', ') || 'None specified'}
- Expected outputs: ${body.context.outputVariables?.join(', ') || 'None specified'}` : ''}`
        : `Create a function based on this request: "${body.prompt}"

${body.context ? `Context:
- Function name: ${body.context.functionName || 'unnamed'}
- Description: ${body.context.description || 'No description'}
- Expected inputs: ${body.context.inputVariables?.join(', ') || 'None specified'}
- Expected outputs: ${body.context.outputVariables?.join(', ') || 'None specified'}` : ''}`;

    try {
        const stream = await c.env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 2048,
            temperature: 0.3,
            stream: true,
        });

        return new Response(stream as ReadableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err: any) {
        console.error('AI code generation stream error:', err);
        return c.json({ error: 'Failed to generate code', details: err.message }, 500);
    }
});

export default functionRouter;
