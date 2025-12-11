import { DurableObject } from "cloudflare:workers";

export class CampaignDO extends DurableObject {
    constructor(state, env) {
        super(state, env);
        this.state = state;
        this.env = env;
        this.campaignId = null;
        this.status = 'idle';
    }

    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // Initialize from ID in path if not set
        if (!this.campaignId) {
            const id = path.split('/').pop(); // simplistic
            // Better: rely on storage or initialization
        }

        if (path.endsWith('/start') && method === 'POST') {
            return this.startCampaign();
        }
        if (path.endsWith('/pause') && method === 'POST') {
            return this.pauseCampaign();
        }
        if (path.endsWith('/status') && method === 'GET') {
            return this.getStatus();
        }

        return new Response("Not found", { status: 404 });
    }

    async startCampaign() {
        this.status = 'running';
        await this.state.storage.put('status', 'running');
        // Logic to start processing audience
        // In a real implementation, this would trigger an alarm or background processing
        // For now, we'll just mock the start
        await this.processNextBatch();
        return new Response(JSON.stringify({ status: 'started' }));
    }

    async pauseCampaign() {
        this.status = 'paused';
        await this.state.storage.put('status', 'paused');
        return new Response(JSON.stringify({ status: 'paused' }));
    }

    async getStatus() {
        // Refresh from storage
        this.status = await this.state.storage.get('status') || 'draft';
        const progress = await this.state.storage.get('progress') || 0;
        return new Response(JSON.stringify({
            status: this.status,
            progress: progress,
            campaignId: this.campaignId
        }));
    }

    async processNextBatch() {
        // Stub for processing logic
        // 1. Fetch pending audience from D1
        // 2. Dispatch to Queue
        // 3. Update local progress
    }
}
