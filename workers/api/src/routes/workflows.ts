import { Hono } from 'hono';
import { getTenantId } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/context.ts';

const workflowsRouter = new Hono<HonoEnv>();

/**
 * List all workflows for tenant
 */
workflowsRouter.get('/', async (c) => {
  const tenantId = getTenantId(c);
  const isActive = c.req.query('active');

  let query = "SELECT * FROM workflows WHERE tenant_id = ?";
  const params: (string | number)[] = [tenantId];

  if (isActive !== undefined) {
    query += " AND is_active = ?";
    params.push(isActive === 'true' ? 1 : 0);
  }

  query += " ORDER BY updated_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Parse definition JSON for each workflow
  const workflows = (results || []).map((workflow: Record<string, unknown>) => ({
    ...workflow,
    definition: workflow.definition ? JSON.parse(workflow.definition as string) : null,
  }));

  return c.json({ workflows });
});

/**
 * Create new workflow
 */
workflowsRouter.post('/', async (c) => {
  const tenantId = getTenantId(c);
  const data = await c.req.json();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(`
    INSERT INTO workflows (id, tenant_id, name, description, trigger_type, definition, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    id,
    tenantId,
    data.name,
    data.description || '',
    data.triggerType || 'manual',
    JSON.stringify(data.definition || { nodes: [], edges: [] }),
    data.isActive ? 1 : 0
  ).run();

  return c.json({ success: true, id });
});

/**
 * Get workflow by ID
 */
workflowsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const workflow = await c.env.DB.prepare("SELECT * FROM workflows WHERE id = ?").bind(id).first();

  if (!workflow) {
    return c.json({ error: "Workflow not found" }, 404);
  }

  // Parse definition JSON
  const parsed = {
    ...workflow,
    definition: workflow.definition ? JSON.parse(workflow.definition as string) : null,
  };

  return c.json({ workflow: parsed });
});

/**
 * Update workflow
 */
workflowsRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();

  await c.env.DB.prepare(`
    UPDATE workflows
    SET name = ?, description = ?, trigger_type = ?, definition = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.name,
    data.description || '',
    data.triggerType || 'manual',
    JSON.stringify(data.definition || { nodes: [], edges: [] }),
    data.isActive ? 1 : 0,
    id
  ).run();

  return c.json({ success: true });
});

/**
 * Delete workflow
 */
workflowsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  // Delete execution logs first
  await c.env.DB.prepare("DELETE FROM workflow_executions WHERE workflow_id = ?").bind(id).run();
  // Delete workflow
  await c.env.DB.prepare("DELETE FROM workflows WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

/**
 * Toggle workflow active status
 */
workflowsRouter.post('/:id/toggle', async (c) => {
  const id = c.req.param('id');

  // Get current status
  const workflow = await c.env.DB.prepare("SELECT is_active FROM workflows WHERE id = ?").bind(id).first();
  if (!workflow) {
    return c.json({ error: "Workflow not found" }, 404);
  }

  const newStatus = workflow.is_active ? 0 : 1;

  await c.env.DB.prepare(
    "UPDATE workflows SET is_active = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(newStatus, id).run();

  return c.json({ success: true, isActive: newStatus === 1 });
});

/**
 * Execute workflow manually
 */
workflowsRouter.post('/:id/execute', async (c) => {
  const workflowId = c.req.param('id');
  const tenantId = getTenantId(c);
  const data = await c.req.json();

  // Get workflow definition
  const workflow = await c.env.DB.prepare("SELECT * FROM workflows WHERE id = ?").bind(workflowId).first();
  if (!workflow) {
    return c.json({ error: "Workflow not found" }, 404);
  }

  const definition = workflow.definition ? JSON.parse(workflow.definition as string) : null;
  if (!definition || !definition.nodes || definition.nodes.length === 0) {
    return c.json({ error: "Workflow has no definition" }, 400);
  }

  // Create unique execution ID for the DO
  const executionId = crypto.randomUUID();

  // Get customer info if customerId provided
  let customer = null;
  if (data.customerId) {
    customer = await c.env.DB.prepare(`
      SELECT id, email, phone, first_name, last_name, tags, metadata
      FROM customers WHERE id = ?
    `).bind(data.customerId).first();

    if (customer) {
      customer = {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.first_name,
        lastName: customer.last_name,
        tags: customer.tags ? JSON.parse(customer.tags as string) : [],
        metadata: customer.metadata ? JSON.parse(customer.metadata as string) : {},
      };
    }
  }

  // Invoke WorkflowDO for this execution
  const doId = c.env.WORKFLOW.idFromName(executionId);
  const stub = c.env.WORKFLOW.get(doId);

  const response = await stub.fetch(new Request('https://workflow-do/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowId,
      definition,
      context: {
        tenantId,
        customerId: data.customerId,
        triggerEvent: data.triggerEvent || 'manual',
        triggerData: data.triggerData || {},
        variables: data.variables || {},
        customer,
      },
    }),
  }));

  const result = await response.json();

  // Update workflow run stats
  await c.env.DB.prepare(`
    UPDATE workflows
    SET run_count = run_count + 1, last_run_at = datetime('now')
    WHERE id = ?
  `).bind(workflowId).run();

  return c.json(result, response.ok ? 200 : 500);
});

/**
 * Test workflow (dry run)
 */
workflowsRouter.post('/:id/test', async (c) => {
  const workflowId = c.req.param('id');
  const tenantId = getTenantId(c);
  const data = await c.req.json();

  // Get workflow definition
  const workflow = await c.env.DB.prepare("SELECT * FROM workflows WHERE id = ?").bind(workflowId).first();
  if (!workflow) {
    return c.json({ error: "Workflow not found" }, 404);
  }

  const definition = workflow.definition ? JSON.parse(workflow.definition as string) : null;
  if (!definition) {
    return c.json({ error: "Workflow has no definition" }, 400);
  }

  // Validate workflow structure
  const validation = validateWorkflow(definition);
  if (!validation.valid) {
    return c.json({ valid: false, errors: validation.errors });
  }

  // Create test execution (use test prefix)
  const executionId = `test-${crypto.randomUUID()}`;

  // Mock customer for testing
  const testCustomer = {
    id: 'test-customer',
    email: data.testEmail || 'test@example.com',
    phone: data.testPhone || '+1234567890',
    firstName: 'Test',
    lastName: 'User',
    tags: ['test'],
    metadata: {},
  };

  // Invoke WorkflowDO for test execution
  const doId = c.env.WORKFLOW.idFromName(executionId);
  const stub = c.env.WORKFLOW.get(doId);

  const response = await stub.fetch(new Request('https://workflow-do/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowId,
      definition,
      context: {
        tenantId,
        customerId: 'test-customer',
        triggerEvent: 'test',
        triggerData: { test: true },
        variables: data.variables || {},
        customer: testCustomer,
      },
    }),
  }));

  const result = await response.json() as Record<string, unknown>;
  return c.json({ ...result, isTest: true });
});

/**
 * Get workflow execution status
 */
workflowsRouter.get('/executions/:executionId/status', async (c) => {
  const executionId = c.req.param('executionId');

  const doId = c.env.WORKFLOW.idFromName(executionId);
  const stub = c.env.WORKFLOW.get(doId);

  const response = await stub.fetch(new Request('https://workflow-do/status', {
    method: 'GET',
  }));

  const result = await response.json();
  return c.json(result);
});

/**
 * Cancel workflow execution
 */
workflowsRouter.post('/executions/:executionId/cancel', async (c) => {
  const executionId = c.req.param('executionId');

  const doId = c.env.WORKFLOW.idFromName(executionId);
  const stub = c.env.WORKFLOW.get(doId);

  const response = await stub.fetch(new Request('https://workflow-do/cancel', {
    method: 'POST',
  }));

  const result = await response.json();
  return c.json(result);
});

/**
 * List workflow executions
 */
workflowsRouter.get('/:id/executions', async (c) => {
  const workflowId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const status = c.req.query('status');

  let query = "SELECT * FROM workflow_executions WHERE workflow_id = ?";
  const params: (string | number)[] = [workflowId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY started_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Parse JSON fields
  const executions = (results || []).map((exec: Record<string, unknown>) => ({
    ...exec,
    context: exec.context ? JSON.parse(exec.context as string) : null,
    result: exec.result ? JSON.parse(exec.result as string) : null,
  }));

  // Get total count
  let countQuery = "SELECT COUNT(*) as count FROM workflow_executions WHERE workflow_id = ?";
  const countParams: string[] = [workflowId];
  if (status) {
    countQuery += " AND status = ?";
    countParams.push(status);
  }
  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ count: number }>();

  return c.json({
    executions,
    total: countResult?.count || 0,
    limit,
    offset,
  });
});

/**
 * Trigger workflow by event (for webhooks and integrations)
 */
workflowsRouter.post('/trigger', async (c) => {
  const tenantId = getTenantId(c);
  const data = await c.req.json();
  const { event, customerId, data: eventData } = data;

  if (!event) {
    return c.json({ error: "Event type is required" }, 400);
  }

  // Find active workflows that match this trigger
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM workflows
    WHERE tenant_id = ? AND is_active = 1 AND trigger_type = ?
  `).bind(tenantId, event).all();

  if (!results || results.length === 0) {
    return c.json({ triggered: 0, message: "No matching workflows found" });
  }

  // Get customer info if provided
  let customer = null;
  if (customerId) {
    const customerData = await c.env.DB.prepare(`
      SELECT id, email, phone, first_name, last_name, tags, metadata
      FROM customers WHERE id = ?
    `).bind(customerId).first();

    if (customerData) {
      customer = {
        id: customerData.id,
        email: customerData.email,
        phone: customerData.phone,
        firstName: customerData.first_name,
        lastName: customerData.last_name,
        tags: customerData.tags ? JSON.parse(customerData.tags as string) : [],
        metadata: customerData.metadata ? JSON.parse(customerData.metadata as string) : {},
      };
    }
  }

  // Execute each matching workflow
  const executions: string[] = [];
  for (const workflow of results) {
    const definition = workflow.definition ? JSON.parse(workflow.definition as string) : null;
    if (!definition) continue;

    const executionId = crypto.randomUUID();
    const doId = c.env.WORKFLOW.idFromName(executionId);
    const stub = c.env.WORKFLOW.get(doId);

    try {
      await stub.fetch(new Request('https://workflow-do/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflow.id,
          definition,
          context: {
            tenantId,
            customerId,
            triggerEvent: event,
            triggerData: eventData || {},
            variables: {},
            customer,
          },
        }),
      }));

      executions.push(executionId);

      // Update workflow stats
      await c.env.DB.prepare(`
        UPDATE workflows SET run_count = run_count + 1, last_run_at = datetime('now') WHERE id = ?
      `).bind(workflow.id).run();
    } catch (error) {
      console.error(`Failed to execute workflow ${workflow.id}:`, error);
    }
  }

  return c.json({
    triggered: executions.length,
    executionIds: executions,
  });
});

/**
 * Validate workflow definition
 */
interface WorkflowNode {
  id?: string;
  type?: string;
}

interface WorkflowEdge {
  id?: string;
  source?: string;
  target?: string;
}

interface WorkflowDefinition {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

function validateWorkflow(definition: WorkflowDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!definition.nodes || !Array.isArray(definition.nodes)) {
    errors.push('Workflow must have nodes array');
    return { valid: false, errors };
  }

  if (definition.nodes.length === 0) {
    errors.push('Workflow must have at least one node');
    return { valid: false, errors };
  }

  // Check for start node
  const startNodes = definition.nodes.filter((n) => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Workflow must have a start node');
  } else if (startNodes.length > 1) {
    errors.push('Workflow can only have one start node');
  }

  // Check for end node
  const endNodes = definition.nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('Workflow must have at least one end node');
  }

  // Validate edges reference existing nodes
  if (definition.edges && Array.isArray(definition.edges)) {
    const nodeIds = new Set(definition.nodes.map((n) => n.id));
    for (const edge of definition.edges) {
      if (edge.source && !nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`);
      }
      if (edge.target && !nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export default workflowsRouter;
