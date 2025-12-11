import { Hono } from 'hono';
import { getTenantId } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/context.ts';

const campaignsRouter = new Hono<HonoEnv>();

/**
 * List all campaigns for tenant
 */
campaignsRouter.get('/', async (c) => {
  const tenantId = getTenantId(c);
  const status = c.req.query('status');

  let query = "SELECT * FROM campaigns WHERE tenant_id = ?";
  const params: (string | number)[] = [tenantId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Parse JSON fields
  const campaigns = (results || []).map((campaign: Record<string, unknown>) => ({
    ...campaign,
    channelConfig: campaign.channel_config ? JSON.parse(campaign.channel_config as string) : null,
    scheduleConfig: campaign.schedule_config ? JSON.parse(campaign.schedule_config as string) : null,
    complianceConfig: campaign.compliance_config ? JSON.parse(campaign.compliance_config as string) : null,
    stats: campaign.stats ? JSON.parse(campaign.stats as string) : null,
  }));

  return c.json({ campaigns });
});

/**
 * Create new campaign
 */
campaignsRouter.post('/', async (c) => {
  const tenantId = getTenantId(c);
  const data = await c.req.json();
  const id = crypto.randomUUID();

  // Insert campaign into D1
  await c.env.DB.prepare(`
    INSERT INTO campaigns (
      id, tenant_id, name, type, channel_config, schedule_config, compliance_config, status, created_at, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), ?)
  `).bind(
    id,
    tenantId,
    data.name,
    data.type,
    JSON.stringify(data.channelConfig || {}),
    JSON.stringify(data.scheduleConfig || {}),
    JSON.stringify(data.complianceConfig || {}),
    data.createdBy || null
  ).run();

  return c.json({ success: true, id });
});

/**
 * Get campaign details
 */
campaignsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const campaign = await c.env.DB.prepare("SELECT * FROM campaigns WHERE id = ?").bind(id).first();

  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  // Parse JSON fields
  const parsed = {
    ...campaign,
    channelConfig: campaign.channel_config ? JSON.parse(campaign.channel_config as string) : null,
    scheduleConfig: campaign.schedule_config ? JSON.parse(campaign.schedule_config as string) : null,
    complianceConfig: campaign.compliance_config ? JSON.parse(campaign.compliance_config as string) : null,
    stats: campaign.stats ? JSON.parse(campaign.stats as string) : null,
  };

  return c.json({ campaign: parsed });
});

/**
 * Update campaign
 */
campaignsRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();

  // Check campaign exists and is editable
  const existing = await c.env.DB.prepare("SELECT status FROM campaigns WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  if (existing.status !== 'draft') {
    return c.json({ error: "Cannot edit campaign that is not in draft status" }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE campaigns
    SET name = ?, type = ?, channel_config = ?, schedule_config = ?, compliance_config = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.name,
    data.type,
    JSON.stringify(data.channelConfig || {}),
    JSON.stringify(data.scheduleConfig || {}),
    JSON.stringify(data.complianceConfig || {}),
    id
  ).run();

  return c.json({ success: true });
});

/**
 * Delete campaign
 */
campaignsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  // Delete audience first
  await c.env.DB.prepare("DELETE FROM campaign_audiences WHERE campaign_id = ?").bind(id).run();
  // Delete campaign
  await c.env.DB.prepare("DELETE FROM campaigns WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

/**
 * Add audience to campaign
 */
campaignsRouter.post('/:id/audience', async (c) => {
  const campaignId = c.req.param('id');
  const data = await c.req.json();
  const { customerIds, metadata } = data;

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return c.json({ error: "customerIds array is required" }, 400);
  }

  // Batch insert audience members
  const stmt = c.env.DB.prepare(`
    INSERT OR IGNORE INTO campaign_audiences (campaign_id, customer_id, status, metadata)
    VALUES (?, ?, 'pending', ?)
  `);

  const batch = customerIds.map((customerId: string) =>
    stmt.bind(campaignId, customerId, JSON.stringify(metadata || {}))
  );

  await c.env.DB.batch(batch);

  return c.json({
    success: true,
    added: customerIds.length
  });
});

/**
 * Get audience for campaign
 */
campaignsRouter.get('/:id/audience', async (c) => {
  const campaignId = c.req.param('id');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  let query = `
    SELECT ca.*, c.email, c.phone, c.first_name, c.last_name
    FROM campaign_audiences ca
    LEFT JOIN customers c ON ca.customer_id = c.id
    WHERE ca.campaign_id = ?
  `;
  const params: (string | number)[] = [campaignId];

  if (status) {
    query += " AND ca.status = ?";
    params.push(status);
  }

  query += " ORDER BY ca.rowid LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Get total count
  let countQuery = "SELECT COUNT(*) as count FROM campaign_audiences WHERE campaign_id = ?";
  const countParams: string[] = [campaignId];
  if (status) {
    countQuery += " AND status = ?";
    countParams.push(status);
  }
  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ count: number }>();

  return c.json({
    audience: results || [],
    total: countResult?.count || 0,
    limit,
    offset
  });
});

/**
 * Remove audience from campaign
 */
campaignsRouter.delete('/:id/audience', async (c) => {
  const campaignId = c.req.param('id');
  const data = await c.req.json();
  const { customerIds } = data;

  if (!customerIds || !Array.isArray(customerIds)) {
    // Remove all audience
    await c.env.DB.prepare("DELETE FROM campaign_audiences WHERE campaign_id = ?").bind(campaignId).run();
  } else {
    // Remove specific customers
    const placeholders = customerIds.map(() => '?').join(',');
    await c.env.DB.prepare(`
      DELETE FROM campaign_audiences WHERE campaign_id = ? AND customer_id IN (${placeholders})
    `).bind(campaignId, ...customerIds).run();
  }

  return c.json({ success: true });
});

/**
 * Initialize campaign in Durable Object (prepares for execution)
 */
campaignsRouter.post('/:id/init', async (c) => {
  const id = c.req.param('id');
  const tenantId = getTenantId(c);

  // Get campaign details
  const campaign = await c.env.DB.prepare("SELECT * FROM campaigns WHERE id = ?").bind(id).first();
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  // Initialize CampaignDO
  const doId = c.env.CAMPAIGN.idFromName(id);
  const stub = c.env.CAMPAIGN.get(doId);

  const response = await stub.fetch(new Request('https://campaign-do/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: campaign.id,
      tenantId,
      name: campaign.name,
      type: campaign.type,
      channelConfig: campaign.channel_config ? JSON.parse(campaign.channel_config as string) : {},
      scheduleConfig: campaign.schedule_config ? JSON.parse(campaign.schedule_config as string) : {},
      complianceConfig: campaign.compliance_config ? JSON.parse(campaign.compliance_config as string) : {},
    }),
  }));

  const result = await response.json();
  return c.json(result);
});

/**
 * Start campaign execution
 */
campaignsRouter.post('/:id/start', async (c) => {
  const id = c.req.param('id');

  // Check campaign exists
  const campaign = await c.env.DB.prepare("SELECT status FROM campaigns WHERE id = ?").bind(id).first();
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  // Get CampaignDO and start
  const doId = c.env.CAMPAIGN.idFromName(id);
  const stub = c.env.CAMPAIGN.get(doId);

  const response = await stub.fetch(new Request('https://campaign-do/start', {
    method: 'POST',
  }));

  const result = await response.json();
  return c.json(result, response.ok ? 200 : 400);
});

/**
 * Pause campaign execution
 */
campaignsRouter.post('/:id/pause', async (c) => {
  const id = c.req.param('id');

  const doId = c.env.CAMPAIGN.idFromName(id);
  const stub = c.env.CAMPAIGN.get(doId);

  const response = await stub.fetch(new Request('https://campaign-do/pause', {
    method: 'POST',
  }));

  const result = await response.json();
  return c.json(result, response.ok ? 200 : 400);
});

/**
 * Resume campaign execution
 */
campaignsRouter.post('/:id/resume', async (c) => {
  const id = c.req.param('id');

  const doId = c.env.CAMPAIGN.idFromName(id);
  const stub = c.env.CAMPAIGN.get(doId);

  const response = await stub.fetch(new Request('https://campaign-do/resume', {
    method: 'POST',
  }));

  const result = await response.json();
  return c.json(result, response.ok ? 200 : 400);
});

/**
 * Cancel campaign
 */
campaignsRouter.post('/:id/cancel', async (c) => {
  const id = c.req.param('id');

  const doId = c.env.CAMPAIGN.idFromName(id);
  const stub = c.env.CAMPAIGN.get(doId);

  const response = await stub.fetch(new Request('https://campaign-do/cancel', {
    method: 'POST',
  }));

  const result = await response.json();
  return c.json(result, response.ok ? 200 : 400);
});

/**
 * Get campaign status (from DO)
 */
campaignsRouter.get('/:id/status', async (c) => {
  const id = c.req.param('id');

  const doId = c.env.CAMPAIGN.idFromName(id);
  const stub = c.env.CAMPAIGN.get(doId);

  const response = await stub.fetch(new Request('https://campaign-do/status', {
    method: 'GET',
  }));

  const result = await response.json();
  return c.json(result);
});

/**
 * Get campaign statistics
 */
campaignsRouter.get('/:id/stats', async (c) => {
  const campaignId = c.req.param('id');

  // Get stats from D1
  const { results } = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied
    FROM campaign_audiences
    WHERE campaign_id = ?
  `).bind(campaignId).all();

  const stats = results?.[0] || {};

  return c.json({ stats });
});

export default campaignsRouter;
