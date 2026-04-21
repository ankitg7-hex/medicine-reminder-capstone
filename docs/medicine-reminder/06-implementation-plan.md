# Implementation Plan

## Purpose

This document updates the implementation plan to reflect the features that are now part of the current application, plus the next recommended work needed to harden the product further.

The product is no longer planned around a demo-only identity model. The implementation now includes persistent signup and login, SQLite-backed storage, a tabbed dashboard, profile management, medication CRUD, schedule generation, dose actions, reminders, audit activity, and device registration.

## Current Implementation Status

### Completed

- React frontend with a production-style signed-in app shell
- Node.js backend API
- SQLite-backed persistent storage
- User signup with `username`, `email`, `password`, and `timezone`
- User login and logout
- Session restoration using stored bearer token
- Protected `/api/me` profile flow
- Profile update flow for `username`, `email`, and `timezone`
- Medication create, list, update, and archive
- Schedule definition with `daily` and `selected-weekdays`
- Dose generation for today and rolling upcoming window
- Daily schedule view
- Dose actions: taken, missed, skipped
- History view and summary cards
- Reminder tracking and reminder processing workflow
- Device registration for reminder delivery channel switching
- Audit log timeline
- Responsive top menu with Overview, feature tabs, and sign-out

### In Progress Or Partially Complete

- Documentation refresh across planning and product docs
- End-to-end verification beyond smoke testing in the current sandbox
- Frontend automated test refresh to align with real auth

### Not Yet Implemented

- Password reset
- Email verification
- Rate limiting and auth lockout
- Secure cookie-based sessions
- Production deployment packaging and environment guides
- Real external notification providers
- Rich reporting and analytics

## Delivery Strategy

From this point forward, the delivery strategy should focus on hardening and incremental production-readiness rather than broad product prototyping.

Recommended approach:

1. Keep the current working feature set stable.
2. Close security and operational gaps around auth and persistence.
3. Expand test coverage for the new SQLite-backed flow.
4. Improve deployment and observability.
5. Add only tightly scoped product enhancements after the foundation is stable.

## Updated Milestone Plan

### Milestone 1: Foundation And Runtime

Status:
Completed

Implemented scope:

- Frontend and backend scaffolding
- Local development flow
- Basic build/test scripts
- Local runtime compatibility with Node 22+

Validation:

- Frontend TypeScript build passes
- Backend syntax/build check passes

### Milestone 2: Authentication And Profile

Status:
Completed

Implemented scope:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `PATCH /api/me`
- Password hashing
- Persistent user and session storage in SQLite
- Protected route handling on backend
- Login/signup UI and account settings UI on frontend

Follow-up work:

- Add login rate limiting
- Add password reset flow
- Add stronger password policy messaging
- Consider moving from bearer token in localStorage to secure cookie sessions

### Milestone 3: Persistent Domain Storage

Status:
Completed

Implemented scope:

- SQLite persistence for:
  - profiles
  - sessions
  - medications
  - schedules
  - dose events
  - reminder events
  - device registrations
  - audit logs
- Local database file path support
- Git ignore protection for local database artifacts

Follow-up work:

- Add migration/versioning strategy
- Add backup and restore guidance
- Add integrity checks and seed tooling

### Milestone 4: Medication Management

Status:
Completed

Implemented scope:

- Medication create, list, detail, update, and archive
- Ownership enforcement by authenticated user
- Form validation for medication and schedule payloads
- Medication editor UI and saved plans view

Follow-up work:

- Add medication search/filter in list page
- Add archive history view in UI if needed

### Milestone 5: Scheduling And Today View

Status:
Completed

Implemented scope:

- Daily recurrence
- Selected weekday recurrence
- One or more reminder times
- Dose generation in backend
- Today board with grouped schedule states

Follow-up work:

- Add more explicit timezone validation
- Add deeper tests for edge dates and DST behavior

### Milestone 6: Dose Actions And History

Status:
Completed

Implemented scope:

- Mark dose as taken, missed, or skipped
- Persist action timestamp and notes
- History retrieval and summary counts
- Frontend history filters and grouped display

Follow-up work:

- Add explicit edit/reversal rules for already-recorded actions if product wants them

### Milestone 7: Reminders And Devices

Status:
Completed

Implemented scope:

- Reminder event generation
- Reminder processing flow
- In-app or push-channel selection based on device registration
- Device registration storage
- Reminder status display
- Auto-miss behavior for stale reminders

Follow-up work:

- Replace mock adapter with a real push/email/SMS provider integration
- Add retry strategy and provider-specific telemetry

### Milestone 8: Dashboard And Navigation

Status:
Completed

Implemented scope:

- Top feature menu
- Overview dashboard as default landing page
- Separate pages rendered by selected tab
- Account tab and right-aligned sign-out action

Follow-up work:

- Add active-route persistence across refresh if desired
- Add breadcrumbs or compact mobile menu if navigation grows

### Milestone 9: Quality, Security, And Operations

Status:
In Progress

Priority work:

- Refresh frontend automated tests for signup/login flow
- Stabilize backend test execution in this environment
- Add auth abuse protections
- Add deployment and environment documentation
- Add structured operational logging
- Add database migration/versioning plan

Exit criteria:

- Critical auth and medication/reminder flows are covered by automated tests
- Security gaps are documented and mitigated
- Local and deployment setup are documented clearly

## Recommended Next Tasks

### High Priority

- Update frontend tests from demo auth to signup/login auth
- Add backend migration bootstrap and schema version tracking
- Add login throttling or rate limiting
- Add logout call handling consistently in UI and tests
- Update README and all planning docs to remove old demo references

### Medium Priority

- Add password confirmation and stronger client-side validation on signup
- Add audit log filtering or pagination
- Add archived medication view in UI
- Add better empty states and onboarding copy for first-time users

### Lower Priority

- Replace localStorage token storage with a stronger session approach
- Add real notification provider integration
- Add account deletion or session management page

## Validation Plan

### Backend

- Signup success and duplicate-user rejection
- Login success and invalid-password rejection
- Protected route rejection without auth
- Medication ownership isolation
- Schedule generation correctness
- Reminder processing correctness

### Frontend

- Signup flow
- Login flow
- Session restore flow
- Overview dashboard rendering
- Tab navigation rendering only one primary page at a time
- Account update flow

### Manual Smoke Checklist

1. Create account with username, email, password, and timezone.
2. Sign out and sign back in with the same credentials.
3. Add a medication plan.
4. Open Schedule and verify generated doses.
5. Mark a dose as taken or missed.
6. Open History and verify the result appears.
7. Register a device in Reminders and verify the channel updates.
8. Open Activity and verify auth and mutation events appear.

## Risks And Mitigations

### Risk: Token storage in localStorage

Mitigation:
Current implementation is simple and works for local development, but should be upgraded to a more secure session approach before a real public deployment.

### Risk: Experimental Node SQLite API

Mitigation:
The current implementation uses Node's built-in SQLite support to avoid extra runtime complexity. If long-term platform stability becomes a concern, migrate to a more established persistence library or service-backed database layer.

### Risk: Timezone correctness around boundary cases

Mitigation:
Add explicit timezone validation and more date-boundary tests, especially around recurring schedules and reminder generation.

### Risk: Auth hardening is incomplete

Mitigation:
Prioritize rate limiting, password reset strategy, and session hardening in the next milestone.

## Definition Of Done For The Next Documentation-Aligned Release

A release increment is complete when:

- The feature works end to end in the current SQLite-backed application
- The UI, backend contract, and documentation all match
- Tests or smoke checks cover the critical success path
- Security and ownership rules are enforced
- No legacy demo-only copy remains in user-facing product flows
