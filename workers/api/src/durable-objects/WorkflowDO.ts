import { DurableObject } from "cloudflare:workers";
import type { WorkerEnv } from "../types/env.ts";
import type { EmailQueueMessage } from "../types/queue.ts";

/**
 * Workflow Types
 */
type StepType = 'start' | 'end' | 'wait' | 'condition' | 'send_message' | 'send_email' | 'add_tag' | 'remove_tag' | 'update_field' | 'webhook' | 'ai_response' | 'run_code';
type ExecutionStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';

interface WorkflowNode {
  id: string;
  type: StepType;
  data: {
    label?: string;
    // Wait step
    duration?: number;
    durationUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
    // Condition step
    field?: string;
    operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_set' | 'is_not_set';
    value?: string | number | boolean;
    // Message step
    channel?: 'email' | 'whatsapp' | 'sms';
    template?: string;
    subject?: string;
    body?: string;
    // Tag step
    tagName?: string;
    // Field step
    fieldName?: string;
    fieldValue?: string;
    // Webhook step
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    // AI response step
    prompt?: string;
    model?: string;
    // Run code step (Platform Functions)
    functionName?: string;
    inputMapping?: Record<string, string>; // Maps workflow variables to function input
    outputVariable?: string; // Variable name to store the function result
    timeout?: number; // Timeout in milliseconds (default 10000)
  };
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // For conditional branches: 'true' or 'false'
  label?: string;
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface ExecutionContext {
  tenantId: string;
  workflowId: string;
  executionId: string;
  customerId?: string;
  triggerEvent?: string;
  triggerData?: Record<string, unknown>;
  variables: Record<string, unknown>;
  customer?: {
    id: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
}

interface ExecutionState {
  status: ExecutionStatus;
  currentNodeId: string | null;
  startedAt: string;
  completedAt?: string;
  error?: string;
  history: Array<{
    nodeId: string;
    nodeType: StepType;
    status: 'completed' | 'failed' | 'skipped';
    timestamp: string;
    result?: unknown;
    error?: string;
  }>;
  waitUntil?: string; // For wait steps
}

export class WorkflowDO extends DurableObject<WorkerEnv> {
  private definition: WorkflowDefinition | null = null;
  private context: ExecutionContext | null = null;
  private state: ExecutionState | null = null;

  constructor(state: DurableObjectState, env: WorkerEnv) {
    super(state, env);
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<void> {
    const [definition, context, state] = await Promise.all([
      this.ctx.storage.get<WorkflowDefinition>('definition'),
      this.ctx.storage.get<ExecutionContext>('context'),
      this.ctx.storage.get<ExecutionState>('state'),
    ]);

    if (definition) this.definition = definition;
    if (context) this.context = context;
    if (state) this.state = state;
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    await Promise.all([
      this.ctx.storage.put('definition', this.definition),
      this.ctx.storage.put('context', this.context),
      this.ctx.storage.put('state', this.state),
    ]);
  }

  /**
   * Main fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    await this.loadState();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Execute workflow
      if (path.endsWith('/execute') && method === 'POST') {
        const data = await request.json() as {
          workflowId: string;
          definition: WorkflowDefinition;
          context: Partial<ExecutionContext>;
        };
        return this.executeWorkflow(data);
      }

      // Resume from wait
      if (path.endsWith('/resume') && method === 'POST') {
        return this.resumeExecution();
      }

      // Get execution status
      if (path.endsWith('/status') && method === 'GET') {
        return this.getStatus();
      }

      // Cancel execution
      if (path.endsWith('/cancel') && method === 'POST') {
        return this.cancelExecution();
      }

      // Trigger workflow (for event-based triggers)
      if (path.endsWith('/trigger') && method === 'POST') {
        const data = await request.json() as {
          event: string;
          data: Record<string, unknown>;
        };
        return this.handleTrigger(data.event, data.data);
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('WorkflowDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Execute workflow
   */
  private async executeWorkflow(data: {
    workflowId: string;
    definition: WorkflowDefinition;
    context: Partial<ExecutionContext>;
  }): Promise<Response> {
    const { workflowId, definition, context } = data;

    // Initialize workflow state
    this.definition = definition;
    this.context = {
      tenantId: context.tenantId || '',
      workflowId,
      executionId: crypto.randomUUID(),
      customerId: context.customerId,
      triggerEvent: context.triggerEvent,
      triggerData: context.triggerData,
      variables: context.variables || {},
      customer: context.customer,
    };

    // Find start node
    const startNode = definition.nodes.find(n => n.type === 'start');
    if (!startNode) {
      return new Response(JSON.stringify({ error: 'No start node found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    this.state = {
      status: 'running',
      currentNodeId: startNode.id,
      startedAt: new Date().toISOString(),
      history: [],
    };

    await this.saveState();

    // Log execution start in D1
    if (this.env.DB) {
      await this.env.DB.prepare(`
        INSERT INTO workflow_executions (id, workflow_id, tenant_id, status, context, started_at)
        VALUES (?, ?, ?, 'running', ?, datetime('now'))
      `).bind(
        this.context.executionId,
        workflowId,
        this.context.tenantId,
        JSON.stringify(this.context)
      ).run();
    }

    // Start execution
    try {
      await this.processCurrentNode();

      return new Response(JSON.stringify({
        success: true,
        executionId: this.context.executionId,
        status: this.state?.status,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.state!.status = 'failed';
      this.state!.error = error instanceof Error ? error.message : 'Execution failed';
      await this.saveState();
      await this.updateExecutionLog('failed', this.state!.error);

      return new Response(JSON.stringify({
        error: this.state!.error,
        executionId: this.context.executionId,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Process current workflow node
   */
  private async processCurrentNode(): Promise<void> {
    if (!this.definition || !this.context || !this.state) {
      throw new Error('Workflow not initialized');
    }

    while (this.state.status === 'running' && this.state.currentNodeId) {
      const currentNode = this.definition.nodes.find(n => n.id === this.state!.currentNodeId);
      if (!currentNode) {
        throw new Error(`Node ${this.state.currentNodeId} not found`);
      }

      console.log(`Processing node: ${currentNode.id} (${currentNode.type})`);

      try {
        const result = await this.executeStep(currentNode);

        // Log step completion
        this.state.history.push({
          nodeId: currentNode.id,
          nodeType: currentNode.type,
          status: 'completed',
          timestamp: new Date().toISOString(),
          result,
        });

        // Check if execution should pause (wait step changes status)
        if ((this.state.status as ExecutionStatus) === 'waiting') {
          await this.saveState();
          return;
        }

        // Find next node
        const nextNodeId = this.getNextNode(currentNode.id, result);
        this.state.currentNodeId = nextNodeId;

        // Check if workflow is complete
        if (!nextNodeId) {
          this.state.status = 'completed';
          this.state.completedAt = new Date().toISOString();
        }

        await this.saveState();
      } catch (error) {
        this.state.history.push({
          nodeId: currentNode.id,
          nodeType: currentNode.type,
          status: 'failed',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Step failed',
        });

        throw error;
      }
    }

    // Update execution log
    await this.updateExecutionLog(this.state.status, undefined, this.state.history);
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(node: WorkflowNode): Promise<unknown> {
    switch (node.type) {
      case 'start':
        return { started: true };

      case 'end':
        return { ended: true };

      case 'wait':
        return this.handleWaitStep(node);

      case 'condition':
        return this.handleConditionStep(node);

      case 'send_message':
      case 'send_email':
        return this.handleSendMessageStep(node);

      case 'add_tag':
        return this.handleAddTagStep(node);

      case 'remove_tag':
        return this.handleRemoveTagStep(node);

      case 'update_field':
        return this.handleUpdateFieldStep(node);

      case 'webhook':
        return this.handleWebhookStep(node);

      case 'ai_response':
        return this.handleAIResponseStep(node);

      case 'run_code':
        return this.handleRunCodeStep(node);

      default:
        console.warn(`Unknown step type: ${node.type}`);
        return { skipped: true, reason: 'Unknown step type' };
    }
  }

  /**
   * Handle wait step
   */
  private async handleWaitStep(node: WorkflowNode): Promise<{ waitUntil: string }> {
    const { duration = 0, durationUnit = 'seconds' } = node.data;

    // Calculate wait duration in milliseconds
    const multipliers: Record<string, number> = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };

    const waitMs = duration * (multipliers[durationUnit] || 1000);
    const waitUntil = new Date(Date.now() + waitMs).toISOString();

    this.state!.status = 'waiting';
    this.state!.waitUntil = waitUntil;

    // Schedule alarm to resume
    await this.ctx.storage.setAlarm(Date.now() + waitMs);

    return { waitUntil };
  }

  /**
   * Handle condition step
   */
  private handleConditionStep(node: WorkflowNode): { result: boolean; reason: string } {
    const { field, operator, value } = node.data;
    if (!field || !operator) {
      return { result: false, reason: 'Missing field or operator' };
    }

    // Get field value from context
    const fieldValue = this.getFieldValue(field);

    let result = false;
    switch (operator) {
      case 'equals':
        result = fieldValue === value;
        break;
      case 'not_equals':
        result = fieldValue !== value;
        break;
      case 'contains':
        result = String(fieldValue).includes(String(value));
        break;
      case 'greater_than':
        result = Number(fieldValue) > Number(value);
        break;
      case 'less_than':
        result = Number(fieldValue) < Number(value);
        break;
      case 'is_set':
        result = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        break;
      case 'is_not_set':
        result = fieldValue === undefined || fieldValue === null || fieldValue === '';
        break;
    }

    return { result, reason: `${field} ${operator} ${value} = ${result}` };
  }

  /**
   * Handle send message step
   */
  private async handleSendMessageStep(node: WorkflowNode): Promise<{ sent: boolean; channel: string }> {
    const { channel = 'email', template, subject, body } = node.data;
    const customer = this.context?.customer;

    if (!customer) {
      return { sent: false, channel };
    }

    switch (channel) {
      case 'email':
        if (!customer.email) {
          return { sent: false, channel };
        }

        // Queue email
        if (this.env.EMAIL_QUEUE) {
          const emailMessage: EmailQueueMessage = {
            to: customer.email,
            subject: this.interpolateTemplate(subject || 'Message from KeyReply', this.context!.variables),
            template,
            tenantId: this.context!.tenantId,
            metadata: {
              workflowId: this.context!.workflowId,
              executionId: this.context!.executionId,
              customerId: customer.id,
            },
            html: body ? this.interpolateTemplate(body, this.context!.variables) : undefined,
          };

          await this.env.EMAIL_QUEUE.send(emailMessage);
          return { sent: true, channel: 'email' };
        }
        break;

      case 'whatsapp':
      case 'sms':
        // TODO: Implement WhatsApp/SMS sending
        console.log(`${channel} sending not yet implemented`);
        return { sent: false, channel };
    }

    return { sent: false, channel };
  }

  /**
   * Handle add tag step
   */
  private async handleAddTagStep(node: WorkflowNode): Promise<{ added: boolean; tag: string }> {
    const { tagName } = node.data;
    const customerId = this.context?.customerId;

    if (!tagName || !customerId) {
      return { added: false, tag: tagName || '' };
    }

    // Update customer tags via CustomerDO
    if (this.env.CUSTOMER) {
      const doId = this.env.CUSTOMER.idFromName(customerId);
      const stub = this.env.CUSTOMER.get(doId);

      await stub.fetch(new Request('https://customer-do/tags/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagName }),
      }));

      // Update local context
      if (this.context?.customer) {
        this.context.customer.tags = this.context.customer.tags || [];
        if (!this.context.customer.tags.includes(tagName)) {
          this.context.customer.tags.push(tagName);
        }
      }

      return { added: true, tag: tagName };
    }

    return { added: false, tag: tagName };
  }

  /**
   * Handle remove tag step
   */
  private async handleRemoveTagStep(node: WorkflowNode): Promise<{ removed: boolean; tag: string }> {
    const { tagName } = node.data;
    const customerId = this.context?.customerId;

    if (!tagName || !customerId) {
      return { removed: false, tag: tagName || '' };
    }

    // Update customer tags via CustomerDO
    if (this.env.CUSTOMER) {
      const doId = this.env.CUSTOMER.idFromName(customerId);
      const stub = this.env.CUSTOMER.get(doId);

      await stub.fetch(new Request('https://customer-do/tags/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagName }),
      }));

      // Update local context
      if (this.context?.customer?.tags) {
        this.context.customer.tags = this.context.customer.tags.filter(t => t !== tagName);
      }

      return { removed: true, tag: tagName };
    }

    return { removed: false, tag: tagName };
  }

  /**
   * Handle update field step
   */
  private async handleUpdateFieldStep(node: WorkflowNode): Promise<{ updated: boolean; field: string; value: unknown }> {
    const { fieldName, fieldValue } = node.data;
    const customerId = this.context?.customerId;

    if (!fieldName || !customerId) {
      return { updated: false, field: fieldName || '', value: fieldValue };
    }

    // Interpolate value
    const interpolatedValue = this.interpolateTemplate(fieldValue || '', this.context!.variables);

    // Update customer field via CustomerDO
    if (this.env.CUSTOMER) {
      const doId = this.env.CUSTOMER.idFromName(customerId);
      const stub = this.env.CUSTOMER.get(doId);

      await stub.fetch(new Request('https://customer-do/fields/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: fieldName, value: interpolatedValue }),
      }));

      return { updated: true, field: fieldName, value: interpolatedValue };
    }

    return { updated: false, field: fieldName, value: interpolatedValue };
  }

  /**
   * Handle webhook step
   */
  private async handleWebhookStep(node: WorkflowNode): Promise<{ success: boolean; statusCode?: number; response?: unknown }> {
    const { url, method = 'POST', headers = {} } = node.data;

    if (!url) {
      return { success: false };
    }

    try {
      // Interpolate URL
      const interpolatedUrl = this.interpolateTemplate(url, this.context!.variables);

      const response = await fetch(interpolatedUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method !== 'GET' ? JSON.stringify({
          workflowId: this.context?.workflowId,
          executionId: this.context?.executionId,
          customerId: this.context?.customerId,
          variables: this.context?.variables,
          customer: this.context?.customer,
        }) : undefined,
      });

      const responseData = await response.json().catch(() => null);

      // Store response in variables for later steps
      this.context!.variables.webhookResponse = responseData;

      return {
        success: response.ok,
        statusCode: response.status,
        response: responseData,
      };
    } catch (error) {
      return {
        success: false,
        response: error instanceof Error ? error.message : 'Webhook failed',
      };
    }
  }

  /**
   * Handle AI response step
   */
  private async handleAIResponseStep(node: WorkflowNode): Promise<{ success: boolean; response?: string }> {
    const { prompt } = node.data;

    if (!prompt || !this.env.AI) {
      return { success: false };
    }

    try {
      // Interpolate prompt
      const interpolatedPrompt = this.interpolateTemplate(prompt, {
        ...this.context!.variables,
        customer: this.context?.customer,
      });

      // Call Workers AI
      const response = await this.env.AI.run('@cf/qwen/qwen3-30b-a3b' as Parameters<typeof this.env.AI.run>[0], {
        prompt: interpolatedPrompt,
        max_tokens: 1024,
      });

      const aiResponse = (response as { response?: string }).response || '';

      // Store AI response in variables
      this.context!.variables.aiResponse = aiResponse;

      return { success: true, response: aiResponse };
    } catch (error) {
      return {
        success: false,
        response: error instanceof Error ? error.message : 'AI response failed',
      };
    }
  }

  /**
   * Handle run_code step - Execute tenant's custom Platform Function
   *
   * This step allows workflows to execute custom JavaScript/TypeScript code
   * uploaded by tenants via the Platform Functions system.
   *
   * The function receives workflow context (variables, customer data) as input
   * and can return data to be stored in workflow variables.
   */
  private async handleRunCodeStep(node: WorkflowNode): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    executionTime?: number;
  }> {
    const {
      functionName,
      inputMapping = {},
      outputVariable = 'codeResult',
      timeout = 10000,
    } = node.data;

    if (!functionName) {
      return { success: false, error: 'Function name is required' };
    }

    if (!this.env.DISPATCHER) {
      return { success: false, error: 'Platform Functions not configured (DISPATCHER binding missing)' };
    }

    const tenantId = this.context?.tenantId;
    if (!tenantId) {
      return { success: false, error: 'Tenant ID not available in workflow context' };
    }

    const startTime = Date.now();

    try {
      // Build the script name using the same convention as PlatformFunctionService
      const safeName = functionName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const scriptName = `tenant_${tenantId}_${safeName}`;

      // Build input payload from inputMapping
      // inputMapping maps function parameter names to workflow variable paths
      // e.g., { "email": "customer.email", "score": "variables.leadScore" }
      const inputPayload: Record<string, unknown> = {};

      for (const [paramName, variablePath] of Object.entries(inputMapping)) {
        const interpolatedPath = this.interpolateTemplate(variablePath, this.context!.variables);
        inputPayload[paramName] = this.getFieldValue(interpolatedPath) ?? interpolatedPath;
      }

      // Add standard context data that all functions receive
      const functionInput = {
        // User-mapped inputs
        ...inputPayload,
        // Standard workflow context (read-only)
        __context: {
          workflowId: this.context!.workflowId,
          executionId: this.context!.executionId,
          customerId: this.context?.customerId,
          customer: this.context?.customer,
          variables: this.context!.variables,
          triggerEvent: this.context?.triggerEvent,
          triggerData: this.context?.triggerData,
        },
      };

      // Get the worker from the dispatch namespace
      const worker = this.env.DISPATCHER.get(scriptName);

      // Create the request to the user's function
      const request = new Request('https://dispatch-worker/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workflow-Execution-Id': this.context!.executionId,
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(functionInput),
      });

      // Execute with timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;
      try {
        response = await worker.fetch(request, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Function execution failed (${response.status}): ${errorText}`,
          executionTime,
        };
      }

      // Parse the response
      let result: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = await response.text();
      }

      // Store the result in workflow variables
      this.context!.variables[outputVariable] = result;

      // If result is an object with explicit variable assignments, merge them
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const resultObj = result as Record<string, unknown>;
        if (resultObj.__variables && typeof resultObj.__variables === 'object') {
          // Allow function to set multiple variables via __variables key
          Object.assign(this.context!.variables, resultObj.__variables);
        }
      }

      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: `Function execution timed out after ${timeout}ms`,
          executionTime,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Function execution failed',
        executionTime,
      };
    }
  }

  /**
   * Get next node based on current node and result
   */
  private getNextNode(currentNodeId: string, result: unknown): string | null {
    if (!this.definition) return null;

    const outgoingEdges = this.definition.edges.filter(e => e.source === currentNodeId);

    if (outgoingEdges.length === 0) {
      return null;
    }

    // For condition nodes, use sourceHandle to determine path
    if (typeof result === 'object' && result !== null && 'result' in result) {
      const conditionResult = (result as { result: boolean }).result;
      const matchingEdge = outgoingEdges.find(e =>
        e.sourceHandle === (conditionResult ? 'true' : 'false')
      );
      if (matchingEdge) {
        return matchingEdge.target;
      }
    }

    // Default: take first edge
    return outgoingEdges[0]?.target || null;
  }

  /**
   * Get field value from context
   */
  private getFieldValue(field: string): unknown {
    const parts = field.split('.');
    let value: unknown = this.context;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Simple template interpolation
   */
  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const parts = path.split('.');
      let value: unknown = data;

      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return match;
        }
      }

      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Update execution log in D1
   */
  private async updateExecutionLog(
    status: ExecutionStatus,
    error?: string,
    result?: unknown
  ): Promise<void> {
    if (!this.env.DB || !this.context) return;

    await this.env.DB.prepare(`
      UPDATE workflow_executions
      SET status = ?,
          result = ?,
          error = ?,
          completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN datetime('now') ELSE NULL END
      WHERE id = ?
    `).bind(
      status,
      result ? JSON.stringify(result) : null,
      error || null,
      status,
      this.context.executionId
    ).run();
  }

  /**
   * Resume execution after wait
   */
  private async resumeExecution(): Promise<Response> {
    if (!this.state || this.state.status !== 'waiting') {
      return new Response(JSON.stringify({ error: 'No execution to resume' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find next node after wait
    const nextNodeId = this.getNextNode(this.state.currentNodeId!, null);
    this.state.status = 'running';
    this.state.currentNodeId = nextNodeId;
    this.state.waitUntil = undefined;

    await this.saveState();

    // Continue processing
    try {
      await this.processCurrentNode();

      return new Response(JSON.stringify({
        success: true,
        executionId: this.context?.executionId,
        status: this.state?.status,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.state!.status = 'failed';
      this.state!.error = error instanceof Error ? error.message : 'Execution failed';
      await this.saveState();
      await this.updateExecutionLog('failed', this.state!.error);

      return new Response(JSON.stringify({
        error: this.state!.error,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get execution status
   */
  private async getStatus(): Promise<Response> {
    return new Response(JSON.stringify({
      status: this.state?.status || 'unknown',
      currentNode: this.state?.currentNodeId,
      startedAt: this.state?.startedAt,
      completedAt: this.state?.completedAt,
      waitUntil: this.state?.waitUntil,
      history: this.state?.history || [],
      error: this.state?.error,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Cancel execution
   */
  private async cancelExecution(): Promise<Response> {
    if (!this.state) {
      return new Response(JSON.stringify({ error: 'No execution to cancel' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    this.state.status = 'cancelled';
    this.state.completedAt = new Date().toISOString();
    await this.saveState();

    // Cancel any pending alarms
    await this.ctx.storage.deleteAlarm();

    // Update D1
    await this.updateExecutionLog('cancelled');

    return new Response(JSON.stringify({
      success: true,
      status: 'cancelled',
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle trigger event
   */
  private async handleTrigger(event: string, data: Record<string, unknown>): Promise<Response> {
    // This would be used for event-based triggers
    // For now, just log and return
    console.log(`Workflow trigger received: ${event}`, data);

    return new Response(JSON.stringify({
      received: true,
      event,
      message: 'Trigger handling implemented via /execute endpoint',
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Alarm handler - resume from wait
   */
  async alarm(): Promise<void> {
    await this.loadState();

    if (this.state?.status === 'waiting') {
      console.log('Resuming workflow after wait');

      // Find next node after wait
      const nextNodeId = this.getNextNode(this.state.currentNodeId!, null);
      this.state.status = 'running';
      this.state.currentNodeId = nextNodeId;
      this.state.waitUntil = undefined;

      await this.saveState();

      try {
        await this.processCurrentNode();
      } catch (error) {
        this.state!.status = 'failed';
        this.state!.error = error instanceof Error ? error.message : 'Execution failed';
        await this.saveState();
        await this.updateExecutionLog('failed', this.state!.error);
      }
    }
  }
}
