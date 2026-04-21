---
name: medicine-reminder-backend
description: Work on the Medicine Reminder App backend. Use when changing auth, profile, SQLite storage, API routes, medications, scheduling, reminders, history, audit logs, or backend tests in `apps/backend`.
---

# Medicine Reminder Backend

Use this skill for anything in `apps/backend`.

## Main Files

- `apps/backend/src/app.js`
- `apps/backend/src/db.js`
- `apps/backend/src/scheduling.js`
- `apps/backend/src/reminders.js`
- `apps/backend/tests/server.test.js`

## What To Keep Consistent

- Backend remains the source of truth for auth and scheduling behavior.
- User ownership stays tied to stable user ids.
- Scheduling logic stays backend-owned.
- Reminder events stay separate from dose events.
- SQLite is the current persistence layer.

## Working Pattern

1. Read the target route or helper first.
2. Check related persistence or scheduling logic.
3. Update API behavior and storage together when needed.
4. Keep frontend response shape compatibility in mind.
5. Update tests for auth, ownership, scheduling, or reminder behavior.

## Validation

- Protected routes still enforce authentication.
- User data remains isolated correctly.
- Schedule and reminder logic still works for the signed-in user.
- Tests or smoke checks cover the changed flow.
