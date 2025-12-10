# Workflow Implementation Plan

## Implementation Status
- [ ] **Phase 1: Data Structure**
    - [ ] JSON Schema Definition
- [ ] **Phase 2: Execution Logic**
    - [ ] Workflow Runner Engine
- [ ] **Phase 3: UI (React Flow)**
    - [ ] Drag-and-drop Editor
    - [ ] Custom Nodes
- [ ] **Phase 4: Integration**
    - [ ] Hook into Customer DO Events


## Overview
A visual automation engine allowing admins to define rules: "If X happens, do Y". It orchestrates triggers (Page View, Inbound Message) and actions (AI Response, Tag User, Send Email).

## Features
- **Visual Editor**: React Flow / XYFlow based drag-and-drop.
- **Triggers**: Page loads, User changes, Incoming messages.
- **Actions**: Branching logic, API calls, AI responses, Human handover.

## Architecture
- **Definition Storage**: JSON blobs in D1 (`workflows` table).
- **Execution Engine**: A shared Worker module or library that takes a `Context` (User, Event) and a `WorkflowDefinition`, then walks the graph.

## Implementation Steps

### Phase 1: Data Structure
```json
{
  "id": "wf_123",
  "nodes": [
    { "id": "1", "type": "trigger", "data": { "event": "page_view" } },
    { "id": "2", "type": "condition", "data": { "field": "time", "op": ">", "value": "17:00" } },
    { "id": "3", "type": "action", "data": { "action": "send_message", "text": "We are closed." } }
  ],
  "edges": [
    { "source": "1", "target": "2" },
    { "source": "2", "target": "3", "label": "true" }
  ]
}
```

### Phase 2: Execution Logic
- **Trigger**: Incoming webhook or internal event (Event Emitter).
- **Runner**:
    - Load workflow JSON.
    - Find start node matching event.
    - Traverse edges.
    - Execute Node logic (async).

### Phase 3: UI (React Flow)
- Install `reactflow` or `@xyflow/react`.
- Create custom Nodes:
    - **TriggerNode**
    - **ActionNode** (with inputs for config)
    - **DecisionNode** (Diamond shape)
- Save functionality serializes graph to JSON for API.

### Phase 4: Integration
- Hook into `CustomerDO`: When `receiveMessage` happens, check for active Workflows and run them.
