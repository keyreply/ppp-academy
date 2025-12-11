import { nanoid } from 'nanoid';

export class EmailQueueService {
    constructor(env) {
        this.queue = env.EMAIL_QUEUE;
        this.db = env.DB;
    }

    /**
     * Queue an email for async sending
     */
    async queueEmail({ to, subject, template, tenantId, metadata }) {
        if (!this.queue) {
            console.warn('EMAIL_QUEUE not configured, skipping async send');
            return { queued: false, error: 'Queue not available' };
        }

        const logId = nanoid();

        // Log as queued
        if (this.db) {
            try {
                await this.db.prepare(`
          INSERT INTO email_logs (id, tenant_id, to_address, from_address, subject, template, metadata, status)
          VALUES (?, ?, ?, 'noreply@keyreply.com', ?, ?, ?, 'queued')
        `).bind(
                    logId,
                    tenantId || null,
                    to,
                    subject,
                    template,
                    JSON.stringify(metadata || {})
                ).run();
            } catch (err) {
                console.error('Failed to log queued email:', err);
            }
        }

        // Send to queue
        try {
            await this.queue.send({
                logId,
                to,
                subject,
                template,
                tenantId,
                metadata,
            });

            return { queued: true, logId };
        } catch (err) {
            console.error('Failed to send to email queue:', err);
            // If queue fails, update log if possible
            if (this.db) {
                await this.db.prepare("UPDATE email_logs SET status = 'failed', error_message = ? WHERE id = ?")
                    .bind("Queue failure: " + err.message, logId)
                    .run()
                    .catch(() => { });
            }
            throw err;
        }
    }
}
