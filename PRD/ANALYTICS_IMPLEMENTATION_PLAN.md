# Dashboard & Analytics Implementation Plan

## Implementation Status
- [ ] **Phase 1: Data Aggregation**
    - [ ] D1 Analytics Table
    - [ ] Queue Ingestion
- [ ] **Phase 2: API Endpoints**
    - [ ] Campaign Stats
    - [ ] Intent Distribution
- [ ] **Phase 3: Frontend Visualization**
    - [ ] Charts


## Overview
This plan outlines the implementation of the Dashboard & Analytics module, providing high-level insights into campaign performance, user journeys, and intent distribution. It leverages the data stored in `CustomerDO` (activities, calls) and `TenantDO` (usage) to generate reports.

## Features
- **Campaign Overview**: Metrics for conversations, intent rates, and engagement.
- **Journey Progression**: Funnel visualization (Picked up -> Interested -> Qualified).
- **Intent Distribution**: Breakdown of call/chat outcomes.
- **Date Range Filtering**: Flexible time-based reporting.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────────────────────┐
│   Frontend      │────▶│  Worker API      │────▶│   Analytics Engine (Worker/DO)    │
│   (Charts/UI)   │     │  (Hono)          │     │   - Aggregates D1 Data            │
│                 │     └──────────────────┘     │   - Queries Customer DOs (Batch)  │
└─────────────────┘                              └────────────────┬──────────────────┘
                                                                  │
                                                         ┌────────▼─────────┐
                                                         │   D1 Database    │
                                                         │   (Read Replicas)│
                                                         └──────────────────┘
```

## Implementation Steps

### Phase 1: Data Aggregation
Since `CustomerDO` holds isolated data, we need a mechanism to aggregate it for analytics without scanning every DO on every request.

#### 1.1 D1 Analytics Tables
Create optimized tables in D1 that are populated asynchronously via Queues or periodic sync from DOs.

```sql
-- Analytics events (flattened for easy querying)
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'call_ended', 'intent_detected', 'funnel_step'
  category TEXT,
  label TEXT, -- e.g., 'interested', 'not_interested'
  value REAL,
  occurred_at DATETIME,
  metadata TEXT
);

CREATE INDEX idx_analytics_tenant_date ON analytics_events(tenant_id, occurred_at);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
```

#### 1.2 Queue-Based Ingestion
Modify `CustomerDO` to emit events to a Queue (`analytics-queue`) whenever a significant action occurs (call end, tag change). A consumer worker processes these and writes to `analytics_events` in D1.

### Phase 2: API Endpoints

#### 2.1 Campaign Stats
`GET /analytics/campaign/:id`
- Queries `analytics_events` for specific campaign tag.
- Aggregates counts for funnel steps.

#### 2.2 Intent Distribution
`GET /analytics/intents`
- `SELECT label, COUNT(*) FROM analytics_events WHERE type='intent_detected' GROUP BY label`

### Phase 3: Frontend Visualization
- Use **Recharts** or **Nivo** for React charts.
- Implement date pickers to filter the API queries.
