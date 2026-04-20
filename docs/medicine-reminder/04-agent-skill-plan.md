# Agent And Skill Plan

This document is for future execution. It does not create runtime automation by itself. It defines how we can split work across parallel coding agents and what skills each stream should bring.

## Recommended Parallel Agent Setup

### Agent 1: Frontend Foundation Agent

- Scope: app shell, routing, layout, design system primitives, form patterns
- Owns:
  - frontend project setup
  - shared page layout
  - navigation
  - reusable form fields
  - base UI states
- Best time to start: immediately after stack approval

### Agent 2: Frontend Features Agent

- Scope: medication screens, dashboard, history, dose action UX
- Owns:
  - medication list page
  - medication form
  - today's schedule screen
  - history page
  - dashboard summary cards
- Best time to start: after API contract and UI shell exist

### Agent 2 Skills

- React and TypeScript
- form design and validation
- optimistic UI handling
- healthcare-adjacent dashboard UX

### Agent 3: Backend Core Agent

- Scope: API service setup, user model, medication CRUD, core data schema
- Owns:
  - backend scaffold
  - ORM setup
  - schema and migrations
  - user and medication endpoints
- Best time to start: immediately after stack approval

### Agent 3 Skills

- REST API design
- schema and migration design
- input validation
- auth and user-scoped resource handling

### Agent 4: Backend Scheduling Agent

- Scope: recurrence model, dose generation, reminder events, worker flow
- Owns:
  - scheduling logic
  - dose event generation
  - reminder event model
  - worker processing
- Best time to start: after medication schema is stable

### Agent 4 Skills

- recurrence modeling
- timezone-safe scheduling
- background jobs
- idempotent event generation

### Agent 5: QA And Integration Agent

- Scope: contract checks, integration tests, seed data, demo readiness
- Owns:
  - API contract verification
  - frontend integration tests
  - backend domain tests
  - demo seed flow
- Best time to start: after CRUD and daily schedule flows are functional

### Agent 5 Skills

- integration testing
- API contract validation
- fixture and seed design
- critical path scenario coverage

## Suggested Agent Sequencing

1. Start Backend Core Agent and Frontend Foundation Agent in parallel.
2. Once entities and contracts stabilize, start Frontend Features Agent.
3. Once schedule model stabilizes, start Backend Scheduling Agent.
4. Start QA And Integration Agent as soon as one end-to-end flow exists.

## Current Suggested Task Split

### Parallel Start Group A

- Agent 1: frontend app shell, routes, mock data contracts
- Agent 3: backend scaffold, database, user and medication schema

### Parallel Start Group B

- Agent 2: dashboard, medicines list, medicine form
- Agent 4: schedule rules, dose generation, reminder events

### Parallel Start Group C

- Agent 5: integration checks, test fixtures, demo flow, acceptance verification

## Recommended Skills By Workstream

### Frontend Skills

- React and TypeScript
- Accessible forms and validation
- State management for async API flows
- Responsive dashboard UI
- Date and time formatting
- Healthcare-adjacent UX copy discipline

### Backend Skills

- REST API design
- Relational schema design
- ORM and migrations
- Validation and DTO design
- Scheduling and recurrence logic
- Background jobs and idempotent worker design

### Shared Skills

- API contract design
- Testing strategy
- Timezone handling
- Documentation discipline
- Safe handling of healthcare-adjacent product language

## Task Ownership Matrix

### Frontend-Led

- app shell
- medication pages
- schedule page
- dose action UI
- history UI
- responsiveness
- accessibility

### Backend-Led

- schema and migrations
- auth or profile identity
- medication CRUD
- recurrence model
- dose event creation
- reminder worker
- audit and logging

### Shared Ownership

- API contract
- error states
- empty states
- date and timezone semantics
- acceptance criteria
- test scenarios

## Handoff Rules For Parallel Work

- Shared contracts must be written before independent implementation begins.
- Agents should own disjoint file areas whenever possible.
- Scheduling logic should not be duplicated in frontend and backend.
- Mock data shape should match backend DTOs exactly.
- QA should validate the highest-risk path first: create medication, generate dose, mark taken, view history.
- Frontend should treat `today reminders` as derived view models, not authored source entities.
- Backend should treat dose logs as audit records, not mutable UI state.

## Review Checklist Before Development Starts

- Is MVP scope frozen enough for milestone 1?
- Is the stack decision approved?
- Are authentication assumptions acceptable for MVP?
- Are recurrence rules intentionally limited?
- Is notification scope contained?
- Are agent boundaries small enough to avoid overlap?
