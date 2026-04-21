# Agent And Skill Plan

This document now maps to a simplified project-local `.codex` setup with one frontend skill and one backend skill, plus one frontend agent and one backend agent.

## Project-Local Assets

### Skills

- `.codex/skills/medicine-reminder-frontend`
- `.codex/skills/medicine-reminder-backend`

### Agents

- `.codex/agents/frontend-agent.md`
- `.codex/agents/backend-agent.md`

These assets are meant to keep future work simple and easy to choose from, while staying in the workspace memory location.

## Recommended Setup

### Frontend Agent

- Scope: app shell, navigation, forms, dashboard, responsive styling, and signed-in UX
- Owns:
  - React UI
  - navigation
- forms
  - overview and tab pages
  - responsive styles
  - frontend tests

### Backend Agent

- Scope: auth, profile, SQLite storage, API routes, medications, schedules, reminders, and backend tests
- Owns:
  - API handlers
  - SQLite persistence
  - auth and profile logic
  - scheduling and reminder logic
  - backend tests

## Task Ownership Matrix

### Frontend-Led

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/styles.css`
- `apps/frontend/src/App.test.tsx`

### Backend-Led

- `apps/backend/src/app.js`
- `apps/backend/src/db.js`
- `apps/backend/src/scheduling.js`
- `apps/backend/src/reminders.js`
- `apps/backend/tests/server.test.js`

### Shared Ownership

- API contract changes
- user-facing behavior that depends on backend response shape
- validation of end-to-end flows

## Handoff Rules For Parallel Work

- Keep frontend and backend ownership separate whenever possible.
- Update both sides together when payload or API shape changes.
- Keep scheduling logic on the backend.
- Keep the frontend product-oriented and non-technical.

## Quick Choice Guide

- Use the frontend skill or agent for UI, layout, styling, navigation, and form work.
- Use the backend skill or agent for auth, storage, API, scheduling, reminders, and tests.
