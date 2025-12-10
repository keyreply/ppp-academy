/**
 * PPP Academy API Client
 * Centralized client for communicating with the backend API.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

class ApiClient {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
            ...options.headers,
        };

        const config = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(url, config);

            // Handle 401 Unauthorized
            if (response.status === 401) {
                this.clearToken();
                // Optionally redirect to login, but better to handle at app level
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                throw new Error('Unauthorized');
            }

            // Parse JSON if content-type is json
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw new Error(data.error || data.message || 'API request failed');
            }

            return data;

        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // HTTP Methods
    get(endpoint, params = {}) {
        // Convert params to query string
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    upload(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);

        return this.request(endpoint, {
            method: 'POST',
            headers: {
                // Content-Type is optional for FormData, but fetch usually handles it
                // 'Content-Type': undefined 
                // We actually need to REMOVE Content-Type so browser sets boundary
            },
            body: formData
        });
    }

    // ==========================================
    // Domain Specific Methods
    // ==========================================

    /* Documents / Knowledge Base */
    documents = {
        list: () => this.get('/documents'),
        get: (id) => this.get(`/documents/${id}`),
        upload: (file) => {
            const formData = new FormData();
            formData.append('file', file);
            return fetch(`${this.baseUrl}/upload`, {
                method: 'POST',
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
                body: formData
            }).then(res => res.json());
        },
        delete: (id) => this.delete(`/documents/${id}`),
        stats: () => this.get('/documents/stats/summary')
    };

    /* Chat / RAG */
    chat = {
        send: (prompt, context, useThinking = false) => this.post('/chat', { prompt, context, useThinking })
    };


    /* Conversations / Chat */
    conversations = {
        list: () => this.get('/conversations'),
        get: (id) => this.get(`/conversations/${id}`),
        getMessages: (id, params) => this.get(`/conversations/${id}/messages`, params),
        sendMessage: (id, content) => this.post(`/conversations/${id}/messages`, { content }),
        create: (data) => this.post('/conversations', data),
        askRAG: (prompt, context) => this.post('/chat', { prompt, context })
    };

    /* Customers */
    customers = {
        list: (params) => this.get('/customers', params),
        get: (id) => this.get(`/customers/${id}`),
        create: (data) => this.post('/customers', data),
        update: (id, data) => this.put(`/customers/${id}`, data),
        delete: (id) => this.delete(`/customers/${id}`)
    };

    /* Auth */
    auth = {
        login: (credentials) => this.post('/auth/login', credentials),
        register: (data) => this.post('/auth/register', data),
        logout: () => this.post('/auth/logout'),
        me: () => this.get('/auth/me')
    };
}

export const api = new ApiClient();
