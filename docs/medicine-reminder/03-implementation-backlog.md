# Implementation Backlog

## Purpose

This document restores the milestone-based implementation backlog and updates it to match the current product state.

The application is no longer a demo-oriented prototype. The current implementation already includes persistent signup and login, SQLite storage, a production-style dashboard shell, profile management, medication management, scheduling, reminders, and audit activity.

This backlog now serves two purposes:

- record what has already been implemented by milestone
- define the next step-by-step implementation flow needed for hardening and product completion

## How To Use This Backlog

Each milestone includes:

- objective
- current status
- detailed implementation tasks
- expected outputs
- validation and exit criteria

The milestones are ordered in delivery sequence so the document can be used as an execution guide instead of only a summary.

## Current Product Baseline

The following capabilities are already implemented in the application:

- account signup with `username`, `email`, `password`, and `timezone`
- account login, logout, and session restoration
- SQLite-backed storage for user, session, medication, schedule, dose, reminder, device, and audit data
- overview dashboard as the default signed-in page
- top navigation for feature pages with right-aligned sign-out
- account settings with profile update support
- medication creation, update, listing, and archive
- daily and selected-weekday scheduling
- generated dose events for today and upcoming views
- dose actions for taken, missed, and skipped
- history summaries and timeline views
- reminder processing and device registration
- audit activity tracking

## Milestone 1: Foundation And Runtime

### Objective

Establish the application structure, runtime, and local development baseline for frontend, backend, and persistent storage.

### Status

Completed

### Detailed Implementation Tasks

1. Create the frontend application shell.
   Detail:
   Set up the React frontend, application entry point, page layout, shared styling, and state flow required for the signed-out and signed-in experiences.

2. Create the backend API runtime.
   Detail:
   Set up the Node.js backend server, JSON request handling, route registration, error handling, and health endpoint needed for frontend integration.

3. Introduce persistent storage support.
   Detail:
   Add SQLite-backed data access and storage bootstrap so user and product data can survive backend restarts.

4. Define the initial domain storage model.
   Detail:
   Create tables for profiles, sessions, medications, schedules, dose events, reminder events, device registrations, and audit logs.

5. Prepare local development support.
   Detail:
   Ensure the repo can run locally with predictable scripts, working build commands, and ignored local database artifacts.

### Expected Outputs

- frontend application runtime
- backend API runtime
- SQLite initialization and storage bootstrap
- local development scripts
- version-control-safe local data handling

### Validation And Exit Criteria

- frontend builds successfully
- backend starts successfully
- SQLite schema initializes without manual intervention
- local database files are not committed to version control

## Milestone 2: Authentication And Session Management

### Objective

Provide production-style account creation, login, logout, and session restore using persisted account records.

### Status

Completed

### Detailed Implementation Tasks

1. Implement account signup.
   Detail:
   Add signup support for `username`, `email`, `password`, and `timezone`, with duplicate-account prevention and normalized identity handling.

2. Implement account login.
   Detail:
   Add credential verification using stored account records and hashed password comparison.

3. Implement session issuance and restore.
   Detail:
   Create session tokens, persist sessions in SQLite, and restore a valid signed-in state when an active token is available.

4. Implement logout.
   Detail:
   Add session invalidation on the backend and state clearing on the frontend.

5. Add profile retrieval and update.
   Detail:
   Support fetching the authenticated user's profile and updating `username`, `email`, and `timezone`.

6. Protect authenticated endpoints.
   Detail:
   Enforce bearer token authentication for profile, medication, schedule, reminder, and audit endpoints.

7. Add signed-out UI flows.
   Detail:
   Provide login and signup forms in the frontend with proper mode switching and error display.

### Expected Outputs

- signup endpoint
- login endpoint
- logout endpoint
- profile read and update endpoints
- frontend auth forms
- session restore behavior
- protected route enforcement

### Validation And Exit Criteria

- user can create an account and sign in later with the same credentials
- invalid credentials are rejected
- duplicate username or email is rejected
- unauthenticated access to protected routes returns `401`
- signed-in profile state restores correctly for active sessions

## Milestone 3: Dashboard Shell And Navigation

### Objective

Create a clear signed-in application shell that feels like a proper application rather than a prototype.

### Status

Completed

### Detailed Implementation Tasks

1. Replace prototype-style framing with product-oriented layout.
   Detail:
   Update the signed-in shell so the dashboard, header, and footer present the product as a production-ready application.

2. Add top navigation menu.
   Detail:
   Provide feature navigation for Overview, Schedule, Medications, History, Reminders, Activity, and Account Settings.

3. Set Overview as the default dashboard page.
   Detail:
   Show the overview page first after successful login so users land on a summary instead of a deep feature page.

4. Move sign-out to the right side of the top menu.
   Detail:
   Make sign-out easy to find without mixing it into the primary feature navigation.

5. Place sign-out inside account-related menu flow where applicable.
   Detail:
   Ensure the account area includes sign-out access and keeps profile-related actions grouped logically.

6. Remove demo-era wording from the UI.
   Detail:
   Eliminate language that implies the product is a demo, MVP, or API showcase.

### Expected Outputs

- signed-in app shell
- overview-first experience
- production-oriented navigation
- account-aligned sign-out placement
- cleaned user-facing copy

### Validation And Exit Criteria

- overview renders first after login
- only the selected major page is shown at a time
- sign-out is easy to locate and works correctly
- no demo wording remains in the user-facing interface

## Milestone 4: Profile And Account Data

### Objective

Store user identity and profile settings in a persistent, user-scoped model that supports future product growth.

### Status

Completed, with hardening work still pending

### Detailed Implementation Tasks

1. Define profile storage fields.
   Detail:
   Persist `id`, `username`, `email`, `passwordHash`, `timezone`, `createdAt`, and `updatedAt` in SQLite.

2. Use stable account identifiers.
   Detail:
   Ensure the user record uses a generated stable identifier rather than deriving identity from mutable fields like email.

3. Tie profile data to session identity.
   Detail:
   Store sessions by token and `user_id` so authenticated requests resolve to the correct profile and owned records.

4. Add profile editing support.
   Detail:
   Allow authenticated users to update account fields while preserving uniqueness constraints and audit history.

5. Record account activity.
   Detail:
   Write audit entries for signup, login, logout, and profile updates.

### Expected Outputs

- durable profile records
- stable user identity model
- authenticated profile update support
- audit trail for account changes

### Validation And Exit Criteria

- profile fields persist across restarts
- uniqueness checks work for username and email
- account changes affect only the signed-in user
- audit history shows relevant account events

## Milestone 5: Medication Management

### Objective

Allow authenticated users to create and manage medication plans tied to their own account.

### Status

Completed

### Detailed Implementation Tasks

1. Add medication creation.
   Detail:
   Support name, type, dosage, instructions, reason, start date, optional end date, recurrence type, reminder times, and weekday configuration.

2. Add medication listing.
   Detail:
   Return user-scoped medication plans for rendering in the frontend.

3. Add medication update.
   Detail:
   Allow editing of medication details and attached schedule configuration.

4. Add medication archive support.
   Detail:
   Stop future active scheduling for archived medications while preserving historical records.

5. Enforce ownership.
   Detail:
   Ensure a user can only create, read, update, or archive their own medication data.

### Expected Outputs

- medication CRUD support
- user-scoped medication listing
- archive behavior tied to medication lifecycle

### Validation And Exit Criteria

- authenticated users can manage their own medications
- archived medications stop contributing new schedule items
- one user cannot access another user's medication records

## Milestone 6: Schedule Generation And Today View

### Objective

Generate dose events from medication schedules and present them in a practical daily workflow.

### Status

Completed, with edge-case validation still pending

### Detailed Implementation Tasks

1. Support daily recurrence.
   Detail:
   Generate schedule entries for medications that repeat every day.

2. Support selected-weekday recurrence.
   Detail:
   Generate schedule entries only on configured weekdays for medications that do not occur daily.

3. Persist schedule definitions.
   Detail:
   Store recurrence type, weekdays, times, active state, and related ownership data in SQLite.

4. Generate dose events.
   Detail:
   Materialize scheduled doses for the user's current day and upcoming window while avoiding duplicate generation.

5. Render the Today or Schedule board.
   Detail:
   Group doses by status so users can quickly identify due, upcoming, completed, missed, and skipped items.

6. Apply user timezone awareness.
   Detail:
   Use the stored user timezone when calculating schedule windows and display states.

### Expected Outputs

- persisted schedules
- generated dose events
- daily schedule UI
- timezone-aware schedule logic

### Validation And Exit Criteria

- daily and weekday schedules generate correctly
- duplicate events are not created for the same time slot
- today view reflects the generated backend state
- schedule behavior follows the user's timezone

## Milestone 7: Dose Actions And History

### Objective

Let users record what happened for each dose and review adherence history over time.

### Status

Completed

### Detailed Implementation Tasks

1. Add dose action support.
   Detail:
   Allow users to mark a dose as taken, missed, or skipped.

2. Persist action metadata.
   Detail:
   Record action timestamps, optional notes, and relevant status changes.

3. Keep history separate from schedule generation.
   Detail:
   Preserve recorded events so user actions remain visible even after the current schedule view changes.

4. Add history retrieval.
   Detail:
   Expose dose history through backend APIs for user-scoped review.

5. Add summary and filters in the frontend.
   Detail:
   Provide counts and filtered views for adherence status and medication-specific review.

### Expected Outputs

- dose action endpoint support
- historical dose records
- frontend history summaries
- filtered history experience

### Validation And Exit Criteria

- dose actions persist correctly
- history reflects the latest recorded outcome
- history data remains isolated to the signed-in user

## Milestone 8: Reminders, Devices, And Activity

### Objective

Support reminder lifecycle tracking, device registration, and user-facing activity visibility.

### Status

Completed, with provider integration still pending

### Detailed Implementation Tasks

1. Add reminder event storage.
   Detail:
   Persist reminder status, scheduled send time, provider metadata, and related dose associations separately from dose records.

2. Add reminder processing.
   Detail:
   Support backend reminder processing that updates reminder state and can affect missed-dose handling according to product rules.

3. Add device registration.
   Detail:
   Allow users to register device tokens and metadata used for reminder channel decisions.

4. Add reminder status visibility.
   Detail:
   Expose reminder records in the frontend so users can review queued, sent, delivered, and failed states.

5. Add audit activity timeline.
   Detail:
   Record important auth and domain actions and display them as a recent activity feed.

### Expected Outputs

- reminder events and processing flow
- device registration support
- reminder status UI
- audit timeline UI

### Validation And Exit Criteria

- reminder events are stored independently of dose events
- registered devices affect reminder channel selection as designed
- activity timeline shows recent user actions

## Milestone 9: Security Hardening

### Objective

Close the most important security and abuse-prevention gaps before broader release use.

### Status

Not yet implemented

### Detailed Implementation Tasks

1. Add signup and login rate limiting.
   Detail:
   Protect auth endpoints from repeated automated attempts by limiting request frequency per client and per identity where appropriate.

2. Add failed-login abuse controls.
   Detail:
   Introduce temporary lockout, throttling, or cooldown rules after repeated invalid credential submissions.

3. Strengthen frontend session handling.
   Detail:
   Review current browser token storage and migrate to a more secure session approach if the deployment model requires stronger protection.

4. Add password reset workflow.
   Detail:
   Define and implement a secure account recovery path that does not expose whether unknown accounts exist.

5. Add email verification workflow.
   Detail:
   Add account verification for newly created users if the deployment model requires verified ownership of email addresses.

6. Improve validation and defensive error handling.
   Detail:
   Ensure auth, profile, and other sensitive endpoints reject malformed input cleanly and never leak sensitive internals in normal error responses.

7. Review audit coverage for security-relevant events.
   Detail:
   Capture suspicious auth events, password changes, and sensitive account updates in audit records where appropriate.

### Expected Outputs

- auth abuse protection
- safer session strategy
- secure account recovery plan
- stronger validation and error hygiene
- improved security audit coverage

### Validation And Exit Criteria

- repeated auth abuse attempts are throttled or blocked
- sensitive auth flows behave predictably under invalid input
- no normal error response exposes implementation secrets
- security-related events are traceable in logs or audit records

## Milestone 10: Testing And Quality Assurance

### Objective

Rebuild reliable automated and manual verification around the current SQLite-backed authenticated product.

### Status

In progress

### Detailed Implementation Tasks

1. Refresh frontend auth tests.
   Detail:
   Replace old demo-auth assumptions with real signup, login, logout, and session restore coverage.

2. Refresh backend integration tests.
   Detail:
   Cover signup, login, duplicate-account rejection, protected route enforcement, profile update, medication ownership, schedule generation, and reminder processing.

3. Stabilize test runtime behavior.
   Detail:
   Resolve environment-specific issues that prevent repeatable automated test execution in the current local or sandbox setup.

4. Add smoke-test coverage.
   Detail:
   Define a small critical-path checklist or script for account creation, sign-in, medication creation, schedule review, dose update, reminder/device flow, and sign-out.

5. Add regression checks for timezone-sensitive scheduling.
   Detail:
   Verify date boundaries, selected weekdays, and future-day generation under realistic timezone inputs.

### Expected Outputs

- updated frontend tests
- updated backend integration tests
- stable smoke-test path
- stronger schedule and auth regression coverage

### Validation And Exit Criteria

- automated tests cover the critical signed-out and signed-in flows
- critical backend ownership rules are validated
- test runs are repeatable in the intended environment
- manual smoke flow is documented and executable

## Milestone 11: Data Platform And Deployment Readiness

### Objective

Make the SQLite-backed application maintainable and deployable beyond local development.

### Status

Not yet implemented

### Detailed Implementation Tasks

1. Add schema versioning and migration support.
   Detail:
   Introduce a migration mechanism so future database schema changes can be applied safely and consistently.

2. Add database integrity and health checks.
   Detail:
   Provide startup or operational checks that detect schema drift, corruption risk, or missing required structures.

3. Add backup and restore guidance.
   Detail:
   Document and, if needed, script how application data should be backed up and restored safely.

4. Add deployment configuration guidance.
   Detail:
   Document required environment variables, runtime assumptions, data directory handling, and startup expectations for deployment.

5. Add structured operational logging.
   Detail:
   Improve observability for auth failures, reminder processing issues, data write failures, and operational incidents.

6. Add seed or bootstrap tooling for non-production environments.
   Detail:
   Provide a clean way to initialize local or test data without polluting production assumptions.

### Expected Outputs

- migration/versioning strategy
- data integrity checks
- deployment runbook
- operational logging baseline
- environment bootstrap support

### Validation And Exit Criteria

- schema changes can be applied in a controlled way
- deployment requirements are documented clearly
- operational failures can be investigated using logs and documented procedures

## Milestone 12: Product Completion And UX Enhancements

### Objective

Improve usability, reporting, and long-tail workflows after security and stability goals are addressed.

### Status

Planned

### Detailed Implementation Tasks

1. Add richer overview dashboard insights.
   Detail:
   Expand overview cards and summaries for adherence, reminders, recent actions, and medication plan status.

2. Add archived medication management in the UI.
   Detail:
   Let users view archived items and, if allowed by product policy, restore them.

3. Add medication search and filtering.
   Detail:
   Improve usability for users with larger medication lists and longer history sets.

4. Add better onboarding and empty states.
   Detail:
   Help first-time users understand what to do next when they have no medications, reminders, devices, or history yet.

5. Add accessibility and responsiveness review.
   Detail:
   Review forms, navigation, status indicators, and layout behavior across common screen sizes and interaction patterns.

6. Add external reminder provider integrations.
   Detail:
   Replace or extend internal reminder processing with real push, email, or SMS delivery integrations if required by the product roadmap.

7. Add advanced adherence reporting.
   Detail:
   Provide deeper summary trends and reporting views once the foundational workflow is stable.

### Expected Outputs

- richer dashboard experience
- better usability for returning users
- stronger first-time user flow
- roadmap path for real reminder delivery
- expanded reporting

### Validation And Exit Criteria

- overview gives useful summary information without overwhelming the user
- larger datasets remain manageable through search or filtering
- empty states guide users to the next action clearly
- UI behavior remains usable on desktop and mobile layouts

## Cross-Milestone Risks

### Risk: Browser token storage remains weaker than ideal

Impact:
The current session approach is acceptable for local development but should be hardened before broader production exposure.

Mitigation:
Prioritize Milestone 9 session hardening decisions before public deployment.

### Risk: SQLite schema evolution becomes difficult without migrations

Impact:
Future product changes may become risky if schema updates are applied manually or inconsistently.

Mitigation:
Prioritize Milestone 11 migration and versioning work before major new feature expansion.

### Risk: Timezone edge cases can cause incorrect scheduling

Impact:
Users may see inaccurate dose timing around date boundaries, weekday transitions, or unusual timezones.

Mitigation:
Expand Milestone 10 regression coverage and Milestone 6 validation for timezone-sensitive logic.

### Risk: Auth hardening gaps create security exposure

Impact:
Repeated login attempts, weak recovery flows, or overexposed error responses can increase product risk.

Mitigation:
Treat Milestone 9 as release-critical work.

## Recommended Next Execution Sequence

1. Complete Milestone 9 security hardening.
2. Complete Milestone 10 automated and manual verification updates.
3. Complete Milestone 11 migration, deployment, and operational readiness.
4. Then continue with Milestone 12 product and UX enhancements.

## Definition Of Ready

A task is ready when:

- the user outcome is clearly defined
- the impacted data and ownership rules are understood
- required UI, API, and storage changes are identified
- test expectations are known

## Definition Of Done

A task is done when:

- it works end to end in the current application
- the behavior is correctly scoped to the authenticated user
- SQLite persistence is handled correctly
- tests or smoke validation cover the main success path
- product and engineering documents are updated if the behavior changed
