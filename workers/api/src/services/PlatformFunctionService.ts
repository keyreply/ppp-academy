import { WorkerEnv } from '../types';
import { PlatformFunction, PlatformFunctionMetadata } from '../types/api';

const NAMESPACE_NAME = 'keyreply-functions';

export class PlatformFunctionService {
    constructor(private env: WorkerEnv) { }

    private getScriptName(tenantId: string, name: string): string {
        // Sanitize name to be safe for Worker names
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
        return `tenant_${tenantId}_${safeName}`;
    }

    private getApiUrl(scriptName: string): string {
        return `https://api.cloudflare.com/client/v4/accounts/${this.env.ACCOUNT_ID}/workers/dispatch/namespaces/${NAMESPACE_NAME}/scripts/${scriptName}`;
    }

    private async fetchCloudflareApi(url: string, method: string, body?: any): Promise<any> {
        if (!this.env.CLOUDFLARE_API_TOKEN) {
            throw new Error('CLOUDFLARE_API_TOKEN is not set');
        }

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
        };

        // If body is a string (script content), sending as javascript
        // If it's an object with multipart/form-data (metadata), handling needs care.
        // For simple User Workers, we upload the script directly as application/javascript or via multipart.
        // The API expects PUT with metadata part and script part typically for advanced usage,
        // but just the script body works for simple cases if Content-Type is application/javascript?
        // Let's check docs: PUT .../scripts/{name}
        // "Upload a Worker script. You can simply upload the script as the body of the request."

        const options: RequestInit = {
            method,
            headers,
        };

        if (body) {
            // If passing raw script content
            if (typeof body === 'string') {
                // Using application/javascript for pure script upload
                headers['Content-Type'] = 'application/javascript';
                options.body = body;
            } else {
                headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Cloudflare API Error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Cloudflare API Error: ${errorText}`);
        }

        return response.json();
    }

    async uploadFunction(tenantId: string, name: string, scriptContent: string, metadata?: PlatformFunctionMetadata): Promise<void> {
        const scriptName = this.getScriptName(tenantId, name);
        const url = this.getApiUrl(scriptName);

        // TODO: support metadata binding. For now, simple script upload.
        // To support `metadata` binding on the User Worker, we need multipart upload.
        // For MVP, we just upload the code.
        await this.fetchCloudflareApi(url, 'PUT', scriptContent);
    }

    async deleteFunction(tenantId: string, name: string): Promise<void> {
        const scriptName = this.getScriptName(tenantId, name);
        const url = this.getApiUrl(scriptName);
        await this.fetchCloudflareApi(url, 'DELETE');
    }

    /**
     * List functions for a tenant.
     * Note: This is expensive if we list ALL and filter.
     * Ideally, we should store a list of functions in our DB/TenantDO.
     * For MVP, we will rely on naming convention prefix if strictly needed, 
     * OR we assume the caller maintains the list (which is better).
     * 
     * BUT, providing a way to list from Cloudflare is useful for sync.
     * This implementation fetches all from namespace and filters.
     */
    async listFunctions(tenantId: string): Promise<string[]> {
        // NOTE: This endpoint lists *all* scripts in the namespace. 
        // If we have thousands of tenants, this is bad.
        // PROPER solution: Store function metadata in D1/KV.
        // Implementation: Skip implementation for now, assume D1 lookup is primary source of truth.
        // We will create a placeholder.
        console.warn('Listing functions via Cloudflare API is not optimized for multi-tenancy. Use local DB.');
        return [];
    }

    async executeFunction(tenantId: string, name: string, payload: any): Promise<any> {
        const scriptName = this.getScriptName(tenantId, name);

        // Use the DISPATCHER binding
        const worker = this.env.DISPATCHER.get(scriptName);

        const request = new Request('https://dispatch-worker/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const response = await worker.fetch(request);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Execution failed: ${text}`);
        }

        // Attempt to parse JSON, fall back to text
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    }
}
