import { Hono } from 'hono';
import { getTenantId } from '../middleware/auth';

const campaignsRouter = new Hono();

// List campaigns
campaignsRouter.get('/', async (c) => {
    const tenantId = getTenantId(c);
    const { results } = await c.env.DB.prepare(
        "SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC"
    ).bind(tenantId).all();
    return c.json({ campaigns: results });
});

// Create campaign
campaignsRouter.post('/', async (c) => {
    const tenantId = getTenantId(c);
    const data = await c.req.json();
    const id = crypto.randomUUID();

    await c.env.DB.prepare(`
        INSERT INTO campaigns (id, tenant_id, name, type, status, created_at)
        VALUES (?, ?, ?, ?, 'draft', datetime('now'))
    `).bind(id, tenantId, data.name, data.type).run();

    return c.json({ success: true, id });
});

// Get campaign details
campaignsRouter.get('/:id', async (c) => {
    const id = c.req.param('id');
    const campaign = await c.env.DB.prepare("SELECT * FROM campaigns WHERE id = ?").bind(id).first();
    if (!campaign) return c.json({ error: "Not found" }, 404);
    return c.json({ campaign });
});

// Start/Pause via DO (Stub for now)
campaignsRouter.post('/:id/action', async (c) => {
    const id = c.req.param('id');
    // Identify campaign ID for DO
    const idObj = c.env.CAMPAIGN.idFromName(id);
    const stub = c.env.CAMPAIGN.get(idObj);

    // Forward request to DO
    return stub.fetch(c.req.raw);
});

export default campaignsRouter;
