import { DurableObject } from "cloudflare:workers";
import type { WorkerEnv } from "../types/env.ts";
import type { EmailQueueMessage } from "../types/queue.ts";

/**
 * Campaign Types
 */
type CampaignType = 'email' | 'voice' | 'whatsapp';
type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'archived';
type AudienceStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'replied';

interface CampaignConfig {
  id: string;
  tenantId: string;
  name: string;
  type: CampaignType;
  channelConfig?: {
    templateId?: string;
    scriptId?: string;
    subject?: string;
    fromName?: string;
  };
  scheduleConfig?: {
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    timezone?: string;
    maxPerHour?: number;
  };
  complianceConfig?: {
    maxConcurrency?: number;
    dncListId?: string;
    retryAttempts?: number;
    cooldownMinutes?: number;
  };
}

interface CampaignState {
  status: CampaignStatus;
  progress: number;
  totalAudience: number;
  sent: number;
  delivered: number;
  failed: number;
  replied: number;
  lastProcessedAt?: string;
  startedAt?: string;
  completedAt?: string;
  currentBatchIndex: number;
}

const BATCH_SIZE = 50;
const ALARM_INTERVAL_MS = 10000; // 10 seconds between batches

export class CampaignDO extends DurableObject<WorkerEnv> {
  private campaignConfig: CampaignConfig | null = null;
  private campaignState: CampaignState = {
    status: 'draft',
    progress: 0,
    totalAudience: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    replied: 0,
    currentBatchIndex: 0,
  };

  constructor(state: DurableObjectState, env: WorkerEnv) {
    super(state, env);
  }

  /**
   * Initialize campaign state from storage
   */
  private async loadState(): Promise<void> {
    const [config, state] = await Promise.all([
      this.ctx.storage.get<CampaignConfig>('config'),
      this.ctx.storage.get<CampaignState>('state'),
    ]);

    if (config) this.campaignConfig = config;
    if (state) this.campaignState = state;
  }

  /**
   * Save campaign state to storage
   */
  private async saveState(): Promise<void> {
    await Promise.all([
      this.ctx.storage.put('config', this.campaignConfig),
      this.ctx.storage.put('state', this.campaignState),
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
      // Initialize campaign
      if (path.endsWith('/init') && method === 'POST') {
        const config = await request.json() as CampaignConfig;
        return this.initializeCampaign(config);
      }

      // Start campaign
      if (path.endsWith('/start') && method === 'POST') {
        return this.startCampaign();
      }

      // Pause campaign
      if (path.endsWith('/pause') && method === 'POST') {
        return this.pauseCampaign();
      }

      // Resume campaign
      if (path.endsWith('/resume') && method === 'POST') {
        return this.resumeCampaign();
      }

      // Cancel campaign
      if (path.endsWith('/cancel') && method === 'POST') {
        return this.cancelCampaign();
      }

      // Get status
      if (path.endsWith('/status') && method === 'GET') {
        return this.getStatus();
      }

      // Update stats (called by queue consumer)
      if (path.endsWith('/stats') && method === 'POST') {
        const stats = await request.json() as { type: string; count: number };
        return this.updateStats(stats);
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('CampaignDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Initialize campaign with configuration
   */
  private async initializeCampaign(config: CampaignConfig): Promise<Response> {
    this.campaignConfig = config;
    this.campaignState = {
      status: 'draft',
      progress: 0,
      totalAudience: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      replied: 0,
      currentBatchIndex: 0,
    };

    // Get total audience count from D1
    if (this.env.DB) {
      const result = await this.env.DB.prepare(
        "SELECT COUNT(*) as count FROM campaign_audiences WHERE campaign_id = ? AND status = 'pending'"
      ).bind(config.id).first<{ count: number }>();

      if (result) {
        this.campaignState.totalAudience = result.count;
      }
    }

    await this.saveState();

    return new Response(JSON.stringify({
      success: true,
      campaignId: config.id,
      totalAudience: this.campaignState.totalAudience
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Start campaign execution
   */
  private async startCampaign(): Promise<Response> {
    if (!this.campaignConfig) {
      return new Response(JSON.stringify({ error: 'Campaign not initialized' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (this.campaignState.status === 'running') {
      return new Response(JSON.stringify({ error: 'Campaign already running' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check schedule constraints
    if (!this.isWithinSchedule()) {
      return new Response(JSON.stringify({
        error: 'Campaign cannot start outside scheduled hours'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    this.campaignState.status = 'running';
    this.campaignState.startedAt = new Date().toISOString();
    await this.saveState();

    // Update D1 status
    if (this.env.DB) {
      await this.env.DB.prepare(
        "UPDATE campaigns SET status = 'running', updated_at = datetime('now') WHERE id = ?"
      ).bind(this.campaignConfig.id).run();
    }

    // Schedule first batch processing via alarm
    await this.ctx.storage.setAlarm(Date.now() + 100);

    return new Response(JSON.stringify({
      success: true,
      status: 'running',
      message: 'Campaign started'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Pause campaign execution
   */
  private async pauseCampaign(): Promise<Response> {
    if (this.campaignState.status !== 'running') {
      return new Response(JSON.stringify({ error: 'Campaign is not running' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    this.campaignState.status = 'paused';
    await this.saveState();

    // Cancel any pending alarms
    await this.ctx.storage.deleteAlarm();

    // Update D1 status
    if (this.env.DB && this.campaignConfig) {
      await this.env.DB.prepare(
        "UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?"
      ).bind(this.campaignConfig.id).run();
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'paused',
      message: 'Campaign paused'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Resume paused campaign
   */
  private async resumeCampaign(): Promise<Response> {
    if (this.campaignState.status !== 'paused') {
      return new Response(JSON.stringify({ error: 'Campaign is not paused' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    this.campaignState.status = 'running';
    await this.saveState();

    // Update D1 status
    if (this.env.DB && this.campaignConfig) {
      await this.env.DB.prepare(
        "UPDATE campaigns SET status = 'running', updated_at = datetime('now') WHERE id = ?"
      ).bind(this.campaignConfig.id).run();
    }

    // Schedule next batch
    await this.ctx.storage.setAlarm(Date.now() + 100);

    return new Response(JSON.stringify({
      success: true,
      status: 'running',
      message: 'Campaign resumed'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Cancel campaign
   */
  private async cancelCampaign(): Promise<Response> {
    this.campaignState.status = 'archived';
    this.campaignState.completedAt = new Date().toISOString();
    await this.saveState();

    // Cancel any pending alarms
    await this.ctx.storage.deleteAlarm();

    // Update D1 status
    if (this.env.DB && this.campaignConfig) {
      await this.env.DB.prepare(
        "UPDATE campaigns SET status = 'archived', updated_at = datetime('now') WHERE id = ?"
      ).bind(this.campaignConfig.id).run();
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'archived',
      message: 'Campaign cancelled'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get current campaign status
   */
  private async getStatus(): Promise<Response> {
    return new Response(JSON.stringify({
      config: this.campaignConfig,
      state: this.campaignState,
      progress: this.campaignState.totalAudience > 0
        ? Math.round((this.campaignState.sent / this.campaignState.totalAudience) * 100)
        : 0
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Update campaign stats (called by queue consumer)
   */
  private async updateStats(stats: { type: string; count: number }): Promise<Response> {
    switch (stats.type) {
      case 'sent':
        this.campaignState.sent += stats.count;
        break;
      case 'delivered':
        this.campaignState.delivered += stats.count;
        break;
      case 'failed':
        this.campaignState.failed += stats.count;
        break;
      case 'replied':
        this.campaignState.replied += stats.count;
        break;
    }

    this.campaignState.progress = this.campaignState.totalAudience > 0
      ? Math.round((this.campaignState.sent / this.campaignState.totalAudience) * 100)
      : 0;

    // Update cached stats in D1
    if (this.env.DB && this.campaignConfig) {
      const statsJson = JSON.stringify({
        total: this.campaignState.totalAudience,
        pending: this.campaignState.totalAudience - this.campaignState.sent,
        sent: this.campaignState.sent,
        delivered: this.campaignState.delivered,
        failed: this.campaignState.failed,
        replied: this.campaignState.replied,
      });

      await this.env.DB.prepare(
        "UPDATE campaigns SET stats = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(statsJson, this.campaignConfig.id).run();
    }

    await this.saveState();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Alarm handler - processes batches
   */
  async alarm(): Promise<void> {
    await this.loadState();

    if (this.campaignState.status !== 'running' || !this.campaignConfig) {
      return;
    }

    // Check schedule constraints
    if (!this.isWithinSchedule()) {
      console.log('Campaign outside scheduled hours, waiting...');
      // Re-check in 5 minutes
      await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000);
      return;
    }

    try {
      const hasMore = await this.processNextBatch();

      if (hasMore) {
        // Schedule next batch
        await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
      } else {
        // Campaign completed
        this.campaignState.status = 'completed';
        this.campaignState.completedAt = new Date().toISOString();
        await this.saveState();

        // Update D1 status
        if (this.env.DB) {
          await this.env.DB.prepare(
            "UPDATE campaigns SET status = 'completed', updated_at = datetime('now') WHERE id = ?"
          ).bind(this.campaignConfig.id).run();
        }

        console.log(`Campaign ${this.campaignConfig.id} completed`);
      }
    } catch (error) {
      console.error('Campaign batch processing error:', error);
      // Retry after delay
      await this.ctx.storage.setAlarm(Date.now() + 30000);
    }
  }

  /**
   * Process next batch of audience members
   */
  private async processNextBatch(): Promise<boolean> {
    if (!this.campaignConfig || !this.env.DB) {
      return false;
    }

    const campaignId = this.campaignConfig.id;

    // Fetch pending audience members
    const { results: audienceMembers } = await this.env.DB.prepare(`
      SELECT ca.customer_id, ca.metadata,
             c.email, c.phone, c.first_name, c.last_name
      FROM campaign_audiences ca
      LEFT JOIN customers c ON ca.customer_id = c.id
      WHERE ca.campaign_id = ? AND ca.status = 'pending'
      ORDER BY ca.rowid
      LIMIT ?
    `).bind(campaignId, BATCH_SIZE).all<{
      customer_id: string;
      metadata: string | null;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
    }>();

    if (!audienceMembers || audienceMembers.length === 0) {
      return false; // No more to process
    }

    console.log(`Processing batch ${this.campaignState.currentBatchIndex + 1}: ${audienceMembers.length} recipients`);

    // Process based on campaign type
    switch (this.campaignConfig.type) {
      case 'email':
        await this.processEmailBatch(audienceMembers);
        break;
      case 'voice':
        await this.processVoiceBatch(audienceMembers);
        break;
      case 'whatsapp':
        await this.processWhatsAppBatch(audienceMembers);
        break;
    }

    // Update batch index
    this.campaignState.currentBatchIndex++;
    this.campaignState.lastProcessedAt = new Date().toISOString();
    await this.saveState();

    return audienceMembers.length === BATCH_SIZE;
  }

  /**
   * Process email campaign batch
   */
  private async processEmailBatch(members: Array<{
    customer_id: string;
    metadata: string | null;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
  }>): Promise<void> {
    if (!this.campaignConfig || !this.env.EMAIL_QUEUE) {
      throw new Error('Email queue not configured');
    }

    const campaignId = this.campaignConfig.id;
    const channelConfig = this.campaignConfig.channelConfig || {};
    const customerIds: string[] = [];

    for (const member of members) {
      if (!member.email) {
        // Mark as failed - no email
        await this.markAudienceStatus(member.customer_id, 'failed', 'No email address');
        continue;
      }

      // Parse member metadata
      const memberMeta = member.metadata ? JSON.parse(member.metadata) : {};

      // Queue email
      const emailMessage: EmailQueueMessage = {
        to: member.email,
        subject: this.interpolateTemplate(
          channelConfig.subject || 'Message from ' + (channelConfig.fromName || 'KeyReply'),
          { name: member.first_name, ...memberMeta }
        ),
        template: channelConfig.templateId,
        tenantId: this.campaignConfig.tenantId,
        metadata: {
          campaignId,
          customerId: member.customer_id,
          firstName: member.first_name,
          lastName: member.last_name,
          ...memberMeta,
        },
      };

      await this.env.EMAIL_QUEUE.send(emailMessage);
      customerIds.push(member.customer_id);
    }

    // Update audience status to queued
    if (customerIds.length > 0 && this.env.DB) {
      const placeholders = customerIds.map(() => '?').join(',');
      await this.env.DB.prepare(`
        UPDATE campaign_audiences
        SET status = 'queued', last_attempt_at = datetime('now'), attempt_count = attempt_count + 1
        WHERE campaign_id = ? AND customer_id IN (${placeholders})
      `).bind(campaignId, ...customerIds).run();

      this.campaignState.sent += customerIds.length;
    }
  }

  /**
   * Process voice campaign batch (via Voice Worker)
   */
  private async processVoiceBatch(members: Array<{
    customer_id: string;
    metadata: string | null;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
  }>): Promise<void> {
    if (!this.campaignConfig) {
      throw new Error('Campaign not configured');
    }

    const campaignId = this.campaignConfig.id;
    const channelConfig = this.campaignConfig.channelConfig || {};
    const complianceConfig = this.campaignConfig.complianceConfig || {};
    const maxConcurrency = complianceConfig.maxConcurrency || 5;

    // Process in smaller concurrent chunks for voice
    const chunks = this.chunkArray(members, maxConcurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (member) => {
        if (!member.phone) {
          await this.markAudienceStatus(member.customer_id, 'failed', 'No phone number');
          return;
        }

        try {
          // Call Voice Worker to initiate call
          if (this.env.VOICE_SERVICE) {
            const memberMeta = member.metadata ? JSON.parse(member.metadata) : {};

            const response = await this.env.VOICE_SERVICE.fetch('https://voice-worker/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenantId: this.campaignConfig!.tenantId,
                campaignId,
                customerId: member.customer_id,
                phoneNumber: member.phone,
                scriptId: channelConfig.scriptId,
                metadata: {
                  firstName: member.first_name,
                  lastName: member.last_name,
                  ...memberMeta,
                },
              }),
            });

            if (response.ok) {
              await this.markAudienceStatus(member.customer_id, 'queued');
              this.campaignState.sent++;
            } else {
              const error = await response.text();
              await this.markAudienceStatus(member.customer_id, 'failed', error);
            }
          } else {
            await this.markAudienceStatus(member.customer_id, 'failed', 'Voice service not available');
          }
        } catch (error) {
          await this.markAudienceStatus(
            member.customer_id,
            'failed',
            error instanceof Error ? error.message : 'Voice call failed'
          );
        }
      });

      await Promise.all(promises);
    }
  }

  /**
   * Process WhatsApp campaign batch
   */
  private async processWhatsAppBatch(members: Array<{
    customer_id: string;
    metadata: string | null;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
  }>): Promise<void> {
    if (!this.campaignConfig) {
      throw new Error('Campaign not configured');
    }

    // WhatsApp API integration would go here
    // For now, mark as failed with "not implemented"
    for (const member of members) {
      await this.markAudienceStatus(
        member.customer_id,
        'failed',
        'WhatsApp campaigns not yet implemented'
      );
    }

    console.log('WhatsApp campaign batch processing not implemented');
  }

  /**
   * Mark audience member status
   */
  private async markAudienceStatus(
    customerId: string,
    status: AudienceStatus,
    errorMessage?: string
  ): Promise<void> {
    if (!this.env.DB || !this.campaignConfig) return;

    await this.env.DB.prepare(`
      UPDATE campaign_audiences
      SET status = ?,
          last_attempt_at = datetime('now'),
          error_message = ?
      WHERE campaign_id = ? AND customer_id = ?
    `).bind(status, errorMessage || null, this.campaignConfig.id, customerId).run();
  }

  /**
   * Check if current time is within schedule
   */
  private isWithinSchedule(): boolean {
    const schedule = this.campaignConfig?.scheduleConfig;
    if (!schedule) return true; // No schedule = always run

    const now = new Date();
    const tz = schedule.timezone || 'UTC';

    // Get current time in campaign timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const dayName = parts.find(p => p.type === 'weekday')?.value || '';

    const currentMinutes = hour * 60 + minute;
    const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayName);

    // Check day of week
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
      if (!schedule.daysOfWeek.includes(dayIndex)) {
        return false;
      }
    }

    // Check time window
    if (schedule.startTime) {
      const [startHour, startMin] = schedule.startTime.split(':').map(Number);
      if (currentMinutes < startHour * 60 + startMin) {
        return false;
      }
    }

    if (schedule.endTime) {
      const [endHour, endMin] = schedule.endTime.split(':').map(Number);
      if (currentMinutes > endHour * 60 + endMin) {
        return false;
      }
    }

    return true;
  }

  /**
   * Simple template interpolation
   */
  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return String(data[key] || match);
    });
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
