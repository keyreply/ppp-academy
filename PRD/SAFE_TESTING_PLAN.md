# Testing & Validation Implementation Plan

## Implementation Status
- [ ] **Phase 1: Sandbox Tenants**
    - [ ] Sandbox Creation Logic
- [ ] **Phase 2: Configuration Versioning**
- [ ] **Phase 3: A/B Testing Logic**
- [ ] **Phase 4: Shadow Mode**


## Overview
Provides safe environments (Sandbox) for testing changes and A/B testing capabilities for optimizing workflows/bots.

## Features
- **Sandbox Mode**: Isolated environment for non-production data.
- **Versioning**: History of configuration changes.
- **A/B Testing**: Split traffic between variations.
- **Shadow Deployment**: Run new configs effectively "silent" alongside prod.

## Architecture
- **Environment Isolation**: Start with logical isolation (Tenant flag `is_sandbox=true`) or separate Cloudflare Worker Environments (`staging`, `prod`).
- **Feature Flags**: Stored in `feature_flags` table (Tenant DO).

## Implementation Steps

### Phase 1: Sandbox Tenants
- Allow creating a "Sandbox" tenant that mirrors a Production tenant.
- Billing is disabled or dummy for sandboxes.
- Emails/Messages sent from Sandbox are intercepted/diverted to a "Safe Sink" (e.g., only allowed to email the admin).

### Phase 2: Configuration Versioning
- Add `version` column to `workflows`, `voice_bots`, `articles` tables.
- UI to "Restore" previous versions.

### Phase 3: A/B Testing Logic
- In `Workflow Runner`:
    - Check for active Experiment on a Trigger.
    - `Math.random() < split_ratio` -> Path A else Path B.
    - Log `experiment_id` and `variant` in `analytics_events`.

### Phase 4: Shadow Mode
- For AI Agents: Process the user input with the *shadow* model/prompt in background (Queue) but do not send the response to the user. Log the result for comparison by Admin.
