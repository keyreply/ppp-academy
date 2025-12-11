import { Hono } from 'hono';

const analyticsRouter = new Hono();

// Helper to get D1 database from bindings
const getDB = (c) => c.env.DB;

/**
 * GET /analytics/campaign/:campaignId
 * Get aggregated stats for a specific campaign or scenario
 */
analyticsRouter.get('/campaign/:campaignId', async (c) => {
    const campaignId = c.req.param('campaignId');
    const db = getDB(c);

    // Example query: funnel steps for this campaign
    // Assuming 'campaignId' is stored in metadata or category
    try {
        const result = await db.prepare(`
        SELECT label, COUNT(*) as count 
        FROM analytics_events 
        WHERE category = ? AND event_type = 'funnel_step'
        GROUP BY label
    `).bind(campaignId).all();

        return c.json({
            campaignId,
            funnel: result.results
        });
    } catch (e) {
        console.error("Analytics Query Error:", e);
        return c.json({ error: e.message }, 500);
    }
});

/**
 * GET /analytics/intents
 * Get distribution of detected intents
 */
analyticsRouter.get('/intents', async (c) => {
    const db = getDB(c);
    const range = c.req.query('range') || '7d'; // 7 days default

    try {
        const result = await db.prepare(`
            SELECT label, COUNT(*) as count 
            FROM analytics_events 
            WHERE event_type = 'intent_detected'
            GROUP BY label
            ORDER BY count DESC
        `).all();

        return c.json({
            intents: result.results
        });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * GET /analytics/dashboard/summary
 * High level summary metrics
 */
analyticsRouter.get('/dashboard/summary', async (c) => {
    const db = getDB(c);

    // Total conversations (approximate from unique sessions or specific event)
    const conversations = await db.prepare(`
        SELECT COUNT(DISTINCT tenant_id) as count FROM analytics_events
    `).first('count');

    // This is just a placeholder query - in reality we'd have better metrics
    return c.json({
        totalConversations: conversations,
        activeUsers: 42, // Mock 
        aiResponseRate: "98%"
    });
});

export default analyticsRouter;
