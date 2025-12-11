import { DurableObject } from "cloudflare:workers";

/**
 * AnalyticsDO - Real-time metrics and analytics Durable Object
 *
 * Features:
 * - Real-time metric tracking (counters, gauges)
 * - Time-bucketed aggregation (minute/hour/day)
 * - Periodic flushing to SQLite
 * - Daily aggregation
 * - Dashboard queries
 */
export class AnalyticsDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;

    // In-memory metrics
    this.counters = new Map(); // metric:bucket -> count
    this.gauges = new Map(); // metric:bucket -> { value, count, min, max, sum }
    this.lastFlush = Date.now();
    this.flushInterval = 60000; // Flush every minute

    // Initialize database
    this.initDatabase();

    // Setup periodic flush
    this.setupFlush();
  }

  /**
   * Initialize SQLite database schema
   */
  async initDatabase() {
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        bucket TEXT NOT NULL,
        value REAL NOT NULL,
        count INTEGER DEFAULT 1,
        min_value REAL,
        max_value REAL,
        sum_value REAL,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS daily_aggregates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        total_count INTEGER DEFAULT 0,
        total_value REAL DEFAULT 0,
        min_value REAL,
        max_value REAL,
        avg_value REAL,
        created_at INTEGER DEFAULT (unixepoch()),
        UNIQUE(name, date, type)
      )
    `);

    // Create indexes
    await this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_name_bucket
      ON metrics(name, bucket)
    `);

    await this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_metrics_created
      ON metrics(created_at DESC)
    `);

    await this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date
      ON daily_aggregates(date DESC, name)
    `);
  }

  /**
   * Setup periodic flush alarm
   */
  setupFlush() {
    this.ctx.storage.setAlarm(Date.now() + this.flushInterval);
  }

  /**
   * Alarm handler for periodic operations
   */
  async alarm() {
    const now = Date.now();

    // Flush in-memory metrics to SQLite
    await this.flush();

    // Check if we need to do daily aggregation (run once per day at midnight UTC)
    const currentDate = new Date().toISOString().split('T')[0];
    const lastAggregation = await this.ctx.storage.get('lastAggregation');

    if (lastAggregation !== currentDate) {
      await this.aggregateDaily();
      await this.ctx.storage.put('lastAggregation', currentDate);
    }

    // Schedule next alarm
    this.ctx.storage.setAlarm(Date.now() + this.flushInterval);
  }

  /**
   * Handle incoming fetch requests
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/increment' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.increment(body);
        return Response.json(result);
      }

      if (path === '/gauge' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.gauge(body);
        return Response.json(result);
      }

      if (path === '/track' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.track(body);
        return Response.json(result);
      }

      if (path === '/metrics' && request.method === 'GET') {
        const name = url.searchParams.get('name');
        const granularity = url.searchParams.get('granularity') || 'hour';
        const startTime = parseInt(url.searchParams.get('startTime')) || (Date.now() - 86400000);
        const endTime = parseInt(url.searchParams.get('endTime')) || Date.now();

        const metrics = await this.getMetrics({ name, granularity, startTime, endTime });
        return Response.json(metrics);
      }

      if (path === '/dashboard' && request.method === 'GET') {
        const timeRange = url.searchParams.get('timeRange') || '24h';
        const dashboard = await this.getDashboard(timeRange);
        return Response.json(dashboard);
      }

      if (path === '/flush' && request.method === 'POST') {
        await this.flush();
        return Response.json({ success: true, flushed: true });
      }

      if (path === '/aggregate' && request.method === 'POST') {
        await this.aggregateDaily();
        return Response.json({ success: true, aggregated: true });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('AnalyticsDO error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  /**
   * Increment a counter metric
   * @param {Object} params
   * @param {string} params.name - Metric name
   * @param {number} params.value - Value to increment by (default: 1)
   * @param {string} params.granularity - Time granularity (minute/hour/day)
   * @returns {Object} { name, value, bucket }
   */
  async increment({ name, value = 1, granularity = 'minute' }) {
    const bucket = this.getBucket(Date.now(), granularity);
    const key = `${name}:${bucket}`;

    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    return {
      name,
      value: current + value,
      bucket,
      granularity
    };
  }

  /**
   * Record a gauge metric (tracks value statistics)
   * @param {Object} params
   * @param {string} params.name - Metric name
   * @param {number} params.value - Current value
   * @param {string} params.granularity - Time granularity
   * @returns {Object} { name, stats, bucket }
   */
  async gauge({ name, value, granularity = 'minute' }) {
    const bucket = this.getBucket(Date.now(), granularity);
    const key = `${name}:${bucket}`;

    let stats = this.gauges.get(key);

    if (!stats) {
      stats = {
        value,
        count: 1,
        min: value,
        max: value,
        sum: value
      };
    } else {
      stats.value = value; // Latest value
      stats.count++;
      stats.min = Math.min(stats.min, value);
      stats.max = Math.max(stats.max, value);
      stats.sum += value;
    }

    this.gauges.set(key, stats);

    return {
      name,
      stats: {
        ...stats,
        avg: stats.sum / stats.count
      },
      bucket,
      granularity
    };
  }

  /**
   * Track a metric (auto-detect counter vs gauge)
   * @param {Object} params
   * @returns {Object}
   */
  async track({ name, value, type = 'counter', granularity = 'minute' }) {
    if (type === 'counter') {
      return this.increment({ name, value, granularity });
    } else {
      return this.gauge({ name, value, granularity });
    }
  }

  /**
   * Get time bucket for a timestamp
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @param {string} granularity - minute/hour/day
   * @returns {string} Bucket identifier
   */
  getBucket(timestamp, granularity) {
    const date = new Date(timestamp);

    switch (granularity) {
      case 'minute':
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;

      case 'hour':
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:00`;

      case 'day':
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

      default:
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    }
  }

  /**
   * Flush in-memory metrics to SQLite
   */
  async flush() {
    const now = Math.floor(Date.now() / 1000);

    // Flush counters
    for (const [key, value] of this.counters.entries()) {
      const [name, bucket] = key.split(':');

      await this.ctx.storage.sql.exec(
        `INSERT INTO metrics (id, name, type, bucket, value, created_at)
         VALUES (?, ?, 'counter', ?, ?, ?)`,
        crypto.randomUUID(), name, bucket, value, now
      );
    }

    // Flush gauges
    for (const [key, stats] of this.gauges.entries()) {
      const [name, bucket] = key.split(':');

      await this.ctx.storage.sql.exec(
        `INSERT INTO metrics (id, name, type, bucket, value, count, min_value, max_value, sum_value, created_at)
         VALUES (?, ?, 'gauge', ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(), name, bucket, stats.value, stats.count,
        stats.min, stats.max, stats.sum, now
      );
    }

    // Clear in-memory metrics
    this.counters.clear();
    this.gauges.clear();
    this.lastFlush = Date.now();

    return {
      flushed: true,
      timestamp: now
    };
  }

  /**
   * Aggregate daily metrics
   */
  async aggregateDaily() {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = yesterday.toISOString().split('T')[0];

    // Aggregate counters
    const counterResult = await this.ctx.storage.sql.exec(
      `SELECT name, type, SUM(value) as total_value, COUNT(*) as total_count
       FROM metrics
       WHERE type = 'counter' AND bucket LIKE ?
       GROUP BY name, type`,
      `${date}%`
    );

    for (const row of counterResult.rows) {
      await this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO daily_aggregates
         (id, name, date, type, total_count, total_value)
         VALUES (?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(), row.name, date, row.type, row.total_count, row.total_value
      );
    }

    // Aggregate gauges
    const gaugeResult = await this.ctx.storage.sql.exec(
      `SELECT name, type,
              SUM(count) as total_count,
              SUM(sum_value) as total_sum,
              MIN(min_value) as min_value,
              MAX(max_value) as max_value
       FROM metrics
       WHERE type = 'gauge' AND bucket LIKE ?
       GROUP BY name, type`,
      `${date}%`
    );

    for (const row of gaugeResult.rows) {
      const avgValue = row.total_sum / row.total_count;

      await this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO daily_aggregates
         (id, name, date, type, total_count, total_value, min_value, max_value, avg_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(), row.name, date, row.type, row.total_count,
        row.total_sum, row.min_value, row.max_value, avgValue
      );
    }

    return {
      aggregated: true,
      date
    };
  }

  /**
   * Get metrics for a time range
   * @param {Object} params
   * @returns {Object} { metrics: [], summary: {} }
   */
  async getMetrics({ name, granularity = 'hour', startTime, endTime }) {
    const startBucket = this.getBucket(startTime, granularity);
    const endBucket = this.getBucket(endTime, granularity);

    const result = await this.ctx.storage.sql.exec(
      `SELECT * FROM metrics
       WHERE name = ? AND bucket >= ? AND bucket <= ?
       ORDER BY bucket ASC`,
      name, startBucket, endBucket
    );

    // Calculate summary statistics
    const counters = result.rows.filter(r => r.type === 'counter');
    const gauges = result.rows.filter(r => r.type === 'gauge');

    const summary = {
      name,
      granularity,
      timeRange: { startTime, endTime },
      counter: {
        total: counters.reduce((sum, r) => sum + r.value, 0),
        count: counters.length
      },
      gauge: {
        count: gauges.length,
        min: gauges.length > 0 ? Math.min(...gauges.map(r => r.min_value)) : null,
        max: gauges.length > 0 ? Math.max(...gauges.map(r => r.max_value)) : null,
        avg: gauges.length > 0
          ? gauges.reduce((sum, r) => sum + (r.sum_value / r.count), 0) / gauges.length
          : null
      }
    };

    return {
      metrics: result.rows,
      summary
    };
  }

  /**
   * Get dashboard data
   * @param {string} timeRange - Time range (1h, 24h, 7d, 30d)
   * @returns {Object}
   */
  async getDashboard(timeRange = '24h') {
    const now = Date.now();
    let startTime;
    let granularity = 'hour';

    switch (timeRange) {
      case '1h':
        startTime = now - 3600000;
        granularity = 'minute';
        break;
      case '24h':
        startTime = now - 86400000;
        granularity = 'hour';
        break;
      case '7d':
        startTime = now - 604800000;
        granularity = 'day';
        break;
      case '30d':
        startTime = now - 2592000000;
        granularity = 'day';
        break;
      default:
        startTime = now - 86400000;
    }

    // Get all unique metric names
    const namesResult = await this.ctx.storage.sql.exec(
      `SELECT DISTINCT name FROM metrics`
    );

    const metrics = [];

    for (const row of namesResult.rows) {
      const metricData = await this.getMetrics({
        name: row.name,
        granularity,
        startTime,
        endTime: now
      });

      metrics.push(metricData);
    }

    // Get recent daily aggregates
    const aggregatesResult = await this.ctx.storage.sql.exec(
      `SELECT * FROM daily_aggregates
       ORDER BY date DESC
       LIMIT 30`
    );

    return {
      timeRange,
      granularity,
      metrics,
      dailyAggregates: aggregatesResult.rows,
      inMemory: {
        counters: this.counters.size,
        gauges: this.gauges.size,
        lastFlush: this.lastFlush
      }
    };
  }
}
