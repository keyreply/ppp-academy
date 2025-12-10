# Campaign Management Implementation Plan

## Implementation Status
- [ ] **Phase 1: Data Model (D1)**
    - [ ] Campaign Tables
- [ ] **Phase 2: Campaign Orchestrator**
    - [ ] Campaign DO
    - [ ] Task Queue
- [ ] **Phase 3: UI**
    - [ ] Creation Wizard
    - [ ] Progress Monitoring


## Overview
Manages high-volume outbound campaigns (Email, Voice, WhatsApp). This module handles the creation of target lists, scheduling, and compliance/throttling rules.

## Features
- **Task/Campaign List**: Status tracking (Draft, Running, Completed).
- **Wizard**: 3-step creation (Info -> Audience -> Compliance).
- **Throttling**: Control concurrency (e.g., max 10 calls/minute).
- **Compliance**: "Do Not Call" lists, time restrictions.

## Architecture
- **CampaignDO**: A Durable Object to manage the state of a single running campaign (counter, pause/resume signal).
- **D1 Database**: Stores campaign configuration and member lists.
- **Cloudflare Queues**: Dispatches individual tasks (e.g., "Call Customer X") to workers.

## Implementation Steps

### Phase 1: Data Model (D1)
```sql
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  type TEXT, -- 'voice', 'email', 'whatsapp'
  status TEXT, -- 'draft', 'scheduled', 'running', 'paused', 'completed'
  schedule_config TEXT, -- JSON: start_time, end_time, days_of_week
  compliance_config TEXT, -- JSON: max_concurrency, dnc_list_id
  created_at DATETIME
);

CREATE TABLE campaign_audiences (
  campaign_id TEXT,
  customer_id TEXT,
  status TEXT, -- 'pending', 'processed', 'failed'
  PRIMARY KEY (campaign_id, customer_id)
);
```

### Phase 2: Campaign Orchestrator (Worker/DO)
- **Start Campaign**: Selects pending customers -> pushes to `campaign-queue`.
- **Queue Consumer**:
    1. Checks compliance (Is it within calling hours? Is DNC?).
    2. Triggers action (e.g., `CustomerDO.logCall` / `VoIP Provider API`).
    3. Updates `campaign_audiences` status.

### Phase 3: UI
- **Wizard**: Stepper component.
- **Progress Bar**: Real-time updates from `CampaignDO` or periodic D1 polling showing % completed.
- **Controls**: Pause/Resume buttons hitting the API.
