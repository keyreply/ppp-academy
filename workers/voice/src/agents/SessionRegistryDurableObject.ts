/**
 * Session Registry Durable Object
 *
 * Maintains a registry of all active voice sessions to support
 * debugging and monitoring.
 */

export interface SessionMetadata {
    sessionId: string;
    startTime: string;
    status: 'active' | 'ended';
    leadId?: string;
    callCount: number;
    lastUpdate: string;
}

export class SessionRegistryDurableObject implements DurableObject {
    private state: DurableObjectState;
    private sessions: Map<string, SessionMetadata> = new Map();

    constructor(state: DurableObjectState, _env: unknown) {
        this.state = state;
        // Load persisted sessions on startup
        this.state.blockConcurrencyWhile(async () => {
            const stored = await this.state.storage.list<SessionMetadata>();
            for (const [key, value] of stored) {
                this.sessions.set(key, value);
            }
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        try {
            if (request.method === 'POST') {
                const data = await request.json() as Partial<SessionMetadata> & { sessionId: string };

                if (path === '/register' || path === '/update') {
                    return this.handleRegister(data);
                } else if (path === '/unregister') {
                    return this.handleUnregister(data.sessionId);
                }
            } else if (request.method === 'GET') {
                if (path === '/list') {
                    return this.handleList();
                }
            } else if (request.method === 'DELETE') {
                if (path === '/purge') {
                    return this.handlePurge();
                }
            }

            return new Response('Not Found', { status: 404 });
        } catch (error) {
            return new Response(JSON.stringify({ error: String(error) }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    private async handlePurge(): Promise<Response> {
        // Clear memory
        this.sessions.clear();
        // Clear storage
        await this.state.storage.deleteAll();

        return new Response(JSON.stringify({ success: true, message: 'All sessions purged' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    private async handleRegister(data: Partial<SessionMetadata> & { sessionId: string }): Promise<Response> {
        const existing = this.sessions.get(data.sessionId) || {
            sessionId: data.sessionId,
            startTime: new Date().toISOString(),
            status: 'active',
            callCount: 0,
            lastUpdate: new Date().toISOString()
        };

        const updated: SessionMetadata = {
            ...existing,
            ...data,
            lastUpdate: new Date().toISOString()
        };

        this.sessions.set(data.sessionId, updated);
        await this.state.storage.put(data.sessionId, updated);

        return new Response(JSON.stringify(updated), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    private async handleUnregister(sessionId: string): Promise<Response> {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.status = 'ended';
            session.lastUpdate = new Date().toISOString();

            // Update status but keep record for a bit (or delete if you want strict active-only)
            // For debug panel, seeing 'ended' recently is useful
            this.sessions.set(sessionId, session);
            await this.state.storage.put(sessionId, session);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    private handleList(): Response {
        // Convert Map to array and sort by lastUpdate descending
        const list = Array.from(this.sessions.values())
            .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime());

        // Filter out very old sessions if needed (e.g. > 24h)

        return new Response(JSON.stringify({ sessions: list }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
