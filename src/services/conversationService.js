import { api } from './api';

class ConversationService {
    constructor() {
        this.activeSocket = null;
        this.currentConversationId = null;
        this.subscribers = {
            message: new Set(),
            typing: new Set(),
            read: new Set(),
            error: new Set()
        };
        this.reconnectTimer = null;
    }

    /**
     * Fetch conversation list
     */
    async getConversations() {
        return api.conversations.list();
    }

    /**
     * Fetch messages for a conversation
     */
    async getMessages(conversationId, params = {}) {
        return api.conversations.getMessages(conversationId, params);
    }

    /**
     * Send a message
     */
    async sendMessage(conversationId, content) {
        return api.conversations.sendMessage(conversationId, content);
    }

    /**
     * Send typing indicator
     */
    async sendTyping(conversationId, isTyping) {
        // We use REST endpoint for sending typing status to ensure reliability,
        // but it could also be done via WS if supported by backend.
        // Current backend supports POST /conversations/:id/typing
        const userId = this.getUserIdFromToken();
        const userName = 'User'; // Should come from user profile/context
        return api.post(`/conversations/${conversationId}/typing`, {
            user_id: userId,
            user_name: userName,
            is_typing: isTyping
        });
    }

    /**
     * Connect to real-time updates for a conversation
     */
    connect(conversationId) {
        if (this.activeSocket && this.currentConversationId === conversationId) {
            return; // Already connected
        }

        this.disconnect(); // Disconnect existing
        this.currentConversationId = conversationId;

        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.error('Cannot connect to WebSocket: No auth token');
            return;
        }

        // Construct WS URL
        // Assumes API_URL is http(s)://host
        const apiUrl = api.baseUrl;
        const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
        const host = apiUrl.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${host}/conversations/${conversationId}/ws?token=${token}`;

        try {
            this.activeSocket = new WebSocket(wsUrl);

            this.activeSocket.onopen = () => {
                console.log(`Connected to conversation ${conversationId}`);
                this.reconnectAttempts = 0;
            };

            this.activeSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (err) {
                    console.error('Failed to parse WS message:', err);
                }
            };

            this.activeSocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.notifySubscribers('error', error);
            };

            this.activeSocket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.activeSocket = null;

                // Attempt reconnect if not explicitly disconnected (1000)
                if (event.code !== 1000 && this.currentConversationId === conversationId) {
                    this.attemptReconnect();
                }
            };

        } catch (err) {
            console.error('Failed to create WebSocket:', err);
        }
    }

    attemptReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (this.currentConversationId) {
                console.log('Attempting to reconnect...');
                this.connect(this.currentConversationId);
            }
        }, 3000);
    }

    disconnect() {
        if (this.activeSocket) {
            this.activeSocket.close(1000, 'User changed conversation');
            this.activeSocket = null;
        }
        this.currentConversationId = null;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    }

    handleMessage(data) {
        switch (data.type) {
            case 'new_message':
                this.notifySubscribers('message', data.message);
                break;
            case 'typing_indicator':
                this.notifySubscribers('typing', data);
                break;
            case 'read_receipt':
                this.notifySubscribers('read', data);
                break;
            default:
            // console.log('Unknown WS message type:', data.type);
        }
    }

    subscribe(event, callback) {
        if (this.subscribers[event]) {
            this.subscribers[event].add(callback);
            return () => this.subscribers[event].delete(callback);
        }
        return () => { };
    }

    notifySubscribers(event, data) {
        if (this.subscribers[event]) {
            this.subscribers[event].forEach(cb => cb(data));
        }
    }

    // Helper to decode JWT simply to get user ID if needed
    getUserIdFromToken() {
        const token = localStorage.getItem('auth_token');
        if (!token) return 'anonymous';
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.sub || payload.id; // Adjust based on token structure
        } catch (e) {
            return 'anonymous';
        }
    }
}

export const conversationService = new ConversationService();
