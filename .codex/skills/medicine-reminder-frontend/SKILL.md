---
name: medicine-reminder-frontend
description: Work on the Medicine Reminder App frontend. Use when changing the React UI, dashboard, navigation, forms, signed-in experience, styling, responsive behavior, or user-facing copy in `apps/frontend`.
---

# Medicine Reminder Frontend

Use this skill for anything in `apps/frontend`.

## Main Files

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/styles.css`
- `apps/frontend/src/App.test.tsx`

## What To Keep Consistent

- Overview is the default page after login.
- Sign-out stays visible on the right side of the top menu.
- The active logged-in user should be visible in the UI.
- User-facing copy should feel product-ready and non-technical.

## Working Pattern

1. Read the target UI section in `App.tsx`.
2. Trace the state and API dependency behind it.
3. Update markup and CSS together.
4. Recheck desktop and mobile behavior.
5. Run the frontend TypeScript build after meaningful UI changes.

## Validation

- Signed-out and signed-in states both render correctly.
- Navigation still works.
- Logged-in identity is visible when a profile exists.
- The UI does not expose internal endpoint or demo wording.
