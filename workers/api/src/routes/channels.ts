import { Hono } from 'hono';
import { getTenantId } from '../middleware/auth';

const channelsRouter = new Hono();

// Get all channel settings for the tenant
channelsRouter.get('/', async (c) => {
    const tenantId = getTenantId(c);

    try {
        const { results } = await c.env.DB.prepare(
            `SELECT channel_type, is_enabled, config, updated_at 
             FROM channel_settings 
             WHERE tenant_id = ?`
        ).bind(tenantId).all();

        // Parse JSON configs and structure response
        const channels = {};
        results.forEach(row => {
            channels[row.channel_type] = {
                isEnabled: row.is_enabled === 1,
                config: row.config ? JSON.parse(row.config) : {},
                updatedAt: row.updated_at
            };
        });

        // Ensure all types exist in response even if not in DB
        const types = ['email', 'sms', 'whatsapp', 'phone'];
        types.forEach(type => {
            if (!channels[type]) {
                channels[type] = { isEnabled: false, config: {} };
            }
        });

        return c.json({ channels });
    } catch (error) {
        console.error('Error fetching channels:', error);
        return c.json({ error: 'Failed to fetch channels' }, 500);
    }
});

// Update specific channel settings
channelsRouter.put('/:type', async (c) => {
    const tenantId = getTenantId(c);
    const channelType = c.req.param('type');
    const { isEnabled, credentials, config } = await c.req.json();

    const allowedTypes = ['email', 'sms', 'whatsapp', 'phone'];
    if (!allowedTypes.includes(channelType)) {
        return c.json({ error: 'Invalid channel type' }, 400);
    }

    try {
        // Upsert settings
        const now = new Date().toISOString();

        // Construct query dynamically based on what's provided
        // Note: For real security, credentials should be encrypted or stored in Secrets/KV if possible.
        // Storing in D1 as plain text (or user-managed logic) for this demo scope.

        let query = `
            INSERT INTO channel_settings (tenant_id, channel_type, is_enabled, credentials, config, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(tenant_id, channel_type) DO UPDATE SET
                is_enabled = excluded.is_enabled,
                updated_at = excluded.updated_at
        `;

        const params = [tenantId, channelType, isEnabled ? 1 : 0, null, null, now];

        if (credentials !== undefined) {
            query += `, credentials = excluded.credentials`;
            params[3] = JSON.stringify(credentials);
        } else {
            // Keep existing credentials if not provided? 
            // SQLITE ON CONFLICT UPDATE cannot easily access "old" value without a separate select in standard replace logic easily mixed with new values.
            // Simplified: We assume full update or we fetch first. 
            // Better strategy: Simple UPSERT with provided values. If credentials missing in payload, maybe don't overwrite?
            // SQLite `excluded` refers to the NEW value.

            // To handle partial updates in UPSERT correctly where we might NOT want to overwrite credentials with NULL:
            // We'll read the existing row first or use coalesce function.
            // Let's stick to simple overwrite for now or use specific SQL logic:
            // credentials = COALESCE(excluded.credentials, channel_settings.credentials) -- BUT excluded.credentials IS user input.
        }

        // Revised simplified UPSERT:
        // We will just do a standard INSERT OR REPLACE if we have all data, or simple UPSERT logic.
        // For 'credentials', if the user sends null/undefined in JSON, we might imply "don't change".
        // But for simplicity in this implementation, we will expect the client to send what needs to be stored.
        // HOWEVER, we usually don't send back credentials to client. So client can't send them back.
        // So we MUST NOT verify/require credentials on every save if only toggling status.

        // Fetch existing first to merge (safest for partial updates like toggle only)
        const existing = await c.env.DB.prepare(
            `SELECT credentials, config FROM channel_settings WHERE tenant_id = ? AND channel_type = ?`
        ).bind(tenantId, channelType).first();

        const newCredentials = credentials !== undefined ? JSON.stringify(credentials) : (existing?.credentials || null);
        const newConfig = config !== undefined ? JSON.stringify(config) : (existing?.config || null);

        await c.env.DB.prepare(`
            INSERT INTO channel_settings (tenant_id, channel_type, is_enabled, credentials, config, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(tenant_id, channel_type) DO UPDATE SET
                is_enabled = excluded.is_enabled,
                credentials = excluded.credentials,
                config = excluded.config,
                updated_at = excluded.updated_at
        `).bind(
            tenantId,
            channelType,
            isEnabled ? 1 : 0,
            newCredentials,
            newConfig,
            now
        ).run();

        return c.json({ success: true, message: 'Settings saved' });
    } catch (error) {
        console.error('Error saving channel settings:', error);
        return c.json({ error: 'Failed to save settings' }, 500);
    }
});

export default channelsRouter;
