/**
 * Analytics Service
 * Handles tracking events by sending them to the Analytics Queue
 */
export class AnalyticsService {
    constructor(env) {
        this.env = env;
        this.queue = env.ANALYTICS_QUEUE;
    }

    /**
     * Track an event
     * @param {string} tenantId - The tenant ID
     * @param {string} eventType - Type of event (e.g., 'page_view', 'conversion')
     * @param {Object} options - Optional parameters
     * @param {string} options.category - Event category
     * @param {string} options.label - Event label
     * @param {number} options.value - Numeric value
     * @param {Object} options.metadata - Additional metadata object
     */
    async track(tenantId, eventType, options = {}) {
        if (!this.queue) {
            console.warn('Analytics Queue not bound. Event dropped:', eventType);
            return;
        }

        const event = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            event_type: eventType,
            category: options.category || 'general',
            label: options.label || null,
            value: options.value || null,
            occurred_at: new Date().toISOString(),
            metadata: options.metadata || {}
        };

        try {
            await this.queue.send(event);
        } catch (error) {
            console.error('Failed to send analytics event to queue:', error);
        }
    }

    /**
     * Batch track events (not commonly used directly, but good for bulk ops)
     */
    async trackBatch(events) {
        if (!this.queue) return;

        // Ensure all have IDs and timestamps if missing
        const preparedEvents = events.map(e => ({
            id: e.id || crypto.randomUUID(),
            occurred_at: e.occurred_at || new Date().toISOString(),
            ...e
        }));

        try {
            await this.queue.sendBatch(preparedEvents);
        } catch (error) {
            console.error('Failed to send batch analytics events:', error);
        }
    }
}
