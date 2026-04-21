# Implementation Backlog
 
This backlog is written as pickup-ready work items. Each task should be small enough for one person or one sub-agent to complete without owning the whole project.
 
## Milestone 0: Planning Sign-Off
 
### Task 0.1
 
- Title: Finalize MVP scope
- Owner: Product
- Outcome: Approved list of MVP features and explicit non-goals
- Dependencies: none
 
### Task 0.2
 
- Title: Choose frontend and backend stack
- Owner: Tech lead
- Outcome: Final stack decision for frontend, backend, database, and jobs
- Dependencies: Task 0.1
 
### Task 0.3
 
- Title: Finalize domain model and API style
- Owner: Backend lead
- Outcome: Approved entities, relationships, and endpoint style
- Dependencies: Task 0.2
 
## Milestone 1: Project Setup
 
### Task 1.1
 
- Title: Scaffold frontend application
- Owner: Frontend
- Outcome: Running app shell with routing, base layout, linting, and formatting
- Dependencies: Task 0.2
 
### Task 1.2
 
- Title: Scaffold backend API service
- Owner: Backend
- Outcome: Running API with health route, env config, linting, and formatting
- Dependencies: Task 0.2
 
### Task 1.3
 
- Title: Set up database and ORM
- Owner: Backend
- Outcome: Connected database, migration setup, and initial schema
- Dependencies: Task 0.3
 
### Task 1.4
 
- Title: Define shared API contract
- Owner: Frontend and Backend
- Outcome: Request and response contract for MVP endpoints
- Dependencies: Task 1.1, Task 1.2, Task 1.3
- Notes:
  - Define DTOs for `Medication`, `MedicationSchedule`, `DoseEvent`, `ReminderEvent`, and `UserProfile`
  - Define error envelope and validation response shape
  - Define timezone and date formatting rules before UI integration
 
### Task 1.5
 
- Title: Establish CI checks
- Owner: Platform
- Outcome: Lint, typecheck, test, and build pipelines
- Dependencies: Task 1.1, Task 1.2
 
### Task 1.6
 
- Title: Create frontend mock data and repository contracts
- Owner: Frontend
- Outcome: UI work can proceed before backend integration without changing component interfaces later
- Dependencies: Task 1.1, Task 1.4
 
## Milestone 2: Authentication Or Profile Foundation
 
### Task 2.1
 
- Title: Implement user model and profile settings
- Owner: Backend
- Outcome: User persistence with timezone support
- Dependencies: Task 1.3
- Notes:
  - Store timestamps in UTC
  - Keep `timezone` on the user profile
  - Add `password_hash`, login audit fields, and account lock metadata
  - Keep email unique and case-normalized
 
### Task 2.2
 
- Title: Build registration and login flow
- Owner: Frontend
- Outcome: Users can enter the app with a stable identity context
- Dependencies: Task 2.1
- Notes:
  - Support sign up, sign in, sign out, and session restore
  - Keep demo account entry optional for walkthroughs, not the primary auth model
 
### Task 2.3
 
- Title: Add auth guards and session handling
- Owner: Frontend and Backend
- Outcome: Protected API access and session-aware frontend routing
- Dependencies: Task 2.1, Task 2.2
- Notes:
  - Use short-lived access tokens and rotating refresh tokens or an equivalent secure session model
  - Derive `user_id` from authenticated context only
 
### Task 2.4
 
- Title: Implement password hashing and token lifecycle
- Owner: Backend
- Outcome: Credentials and sessions are stored and validated safely
- Dependencies: Task 2.1
- Notes:
  - Hash passwords with Argon2id or bcrypt
  - Hash stored refresh tokens
  - Add token expiry, rotation, revocation, and logout-all support
 
### Task 2.5
 
- Title: Add auth validation and abuse protections
- Owner: Backend
- Outcome: Auth endpoints resist common misuse and brute-force attempts
- Dependencies: Task 2.3, Task 2.4
- Notes:
  - Rate limit login, registration, and refresh endpoints
  - Add account lockout or cooldown after repeated failures
  - Return safe, non-enumerating auth error messages
 
### Task 2.6
 
- Title: Build authenticated frontend route handling
- Owner: Frontend
- Outcome: Protected screens redirect correctly and preserve user session state
- Dependencies: Task 2.3
- Notes:
  - Restore session on app load
  - Clear local state on logout or invalid session
  - Handle expired session UX without exposing protected data
 
## Milestone 3: Medication CRUD
 
### Task 3.1
 
- Title: Design medication schema
- Owner: Backend
- Outcome: Medication entity and relations approved and migrated
- Dependencies: Task 1.3
- Notes:
  - Include name, type, dosage, instructions, reason, status, start date, and end date
  - Soft archive instead of hard delete for active care records
 
### Task 3.2
 
- Title: Build medication CRUD endpoints
- Owner: Backend
- Outcome: API supports create, list, detail, update, and archive
- Dependencies: Task 3.1
- Notes:
  - Enforce per-user scoping in every query and mutation
  - Reject access to records outside the authenticated user's scope
 
### Task 3.3
 
- Title: Create medication list page
- Owner: Frontend
- Outcome: User can browse medications and open add or edit flows
- Dependencies: Task 1.1, Task 1.4
 
### Task 3.4
 
- Title: Create add and edit medication form
- Owner: Frontend
- Outcome: Validated form for medication details and schedule basics
- Dependencies: Task 3.2
- Notes:
  - Reuse one form component for create and edit modes
  - Include validation for required name, dosage text, schedule inputs, and date range sanity
 
### Task 3.5
 
- Title: Add archive and empty-state UX
- Owner: Frontend
- Outcome: Safe archive flow and polished list states
- Dependencies: Task 3.3, Task 3.4
 
## Milestone 4: Scheduling And Dose Generation
 
### Task 4.1
 
- Title: Define recurrence model for MVP
- Owner: Backend
- Outcome: Daily recurring schedules and optional multi-time support
- Dependencies: Task 3.1
- Notes:
  - Limit MVP to `daily`, `selected weekdays`, and optionally `every X hours`
  - Avoid full calendar-rule complexity in MVP
 
### Task 4.2
 
- Title: Build schedule persistence and validation
- Owner: Backend
- Outcome: Medication schedules are stored safely with timezone handling
- Dependencies: Task 4.1
- Notes:
  - Validate time inputs, date range sanity, and recurrence payload shape before persistence
 
### Task 4.3
 
- Title: Implement dose event generation service
- Owner: Backend
- Outcome: Upcoming dose events are generated for medications
- Dependencies: Task 4.2
- Notes:
  - Generate a rolling 7 to 14 day window
  - Add idempotency protections for `schedule_id + scheduled_at`
  - Preserve user scoping through generation and fetch paths
 
### Task 4.4
 
- Title: Add schedule inputs to medication form
- Owner: Frontend
- Outcome: User can define reminder times and treatment dates
- Dependencies: Task 4.2
- Notes:
  - Build reusable pieces such as time picker list, weekday selector, and date range inputs
 
### Task 4.5
 
- Title: Build today's schedule view
- Owner: Frontend
- Outcome: Daily list of pending, overdue, and completed doses
- Dependencies: Task 4.3
- Notes:
  - Group by `due now`, `upcoming`, `completed`, and `missed`
  - Add empty states for no medicines and no reminders
 
## Milestone 5: Dose Actions And History
 
### Task 5.1
 
- Title: Create dose action endpoints
- Owner: Backend
- Outcome: API supports marking doses taken, missed, and skipped
- Dependencies: Task 4.3
- Notes:
  - Consider `snooze` as a first-class action if included in MVP
  - Preserve action timestamps and append-only history records
  - Require authenticated ownership of the target dose event
 
### Task 5.2
 
- Title: Build dose action UI
- Owner: Frontend
- Outcome: Users can act on reminders quickly from the daily list
- Dependencies: Task 5.1, Task 4.5
- Notes:
  - Add optimistic updates with rollback on failure
  - Keep actions prominent and one-tap where possible
 
### Task 5.3
 
- Title: Persist action timestamps and audit fields
- Owner: Backend
- Outcome: Dose events store reliable status history
- Dependencies: Task 5.1
 
### Task 5.4
 
- Title: Build medication history page
- Owner: Frontend
- Outcome: User can review historical dose outcomes and filter by medication
- Dependencies: Task 5.3
- Notes:
  - Group by date
  - Filter by medication and status
 
### Task 5.5
 
- Title: Add dashboard summary cards
- Owner: Frontend
- Outcome: Dashboard shows upcoming, completed, and missed counts
- Dependencies: Task 4.5, Task 5.3
 
## Milestone 6: Reminders
 
### Task 6.1
 
- Title: Build reminder event model
- Owner: Backend
- Outcome: Reminder records support scheduling and delivery status
- Dependencies: Task 4.3
- Notes:
  - Separate dose status from delivery status
  - Track queued, sent, delivered, and failed states independently
 
### Task 6.2
 
- Title: Implement reminder worker
- Owner: Backend
- Outcome: Background process identifies due reminders and dispatches them
- Dependencies: Task 6.1
- Notes:
  - Add retry policy for transient failures
  - Reconcile stale reminders into missed status after a policy threshold
 
### Task 6.3
 
- Title: Create notification adapter abstraction
- Owner: Backend
- Outcome: Reminder delivery is pluggable and testable
- Dependencies: Task 6.2
 
### Task 6.4
 
- Title: Add reminder status UI
- Owner: Frontend
- Outcome: User can see upcoming and overdue reminder state
- Dependencies: Task 6.2
 
### Task 6.5
 
- Title: Register device or client notification token
- Owner: Backend and Frontend
- Outcome: Notification-capable client identity can be stored for future push delivery
- Dependencies: Task 2.3, Task 6.2
 
## Milestone 7: Quality And Release Prep
 
### Task 7.1
 
- Title: Add backend unit tests for scheduling and dose logic
- Owner: Backend
- Outcome: Critical domain logic is covered
- Dependencies: Task 4.3, Task 5.3, Task 6.2
 
### Task 7.2
 
- Title: Add frontend integration tests for core user flows
- Owner: Frontend
- Outcome: Medication creation, daily schedule, and dose actions are covered
- Dependencies: Task 3.4, Task 4.5, Task 5.2
 
### Task 7.3
 
- Title: Improve accessibility and responsive behavior
- Owner: Frontend
- Outcome: MVP works on mobile and desktop with accessible navigation and forms
- Dependencies: Task 5.5
 
### Task 7.4
 
- Title: Add logging, monitoring, and error handling baseline
- Owner: Backend
- Outcome: MVP has traceable failures and safe defaults
- Dependencies: Task 6.2
 
### Task 7.5
 
- Title: Add security headers and secure client-server defaults
- Owner: Frontend and Backend
- Outcome: MVP ships with baseline browser and API hardening
- Dependencies: Task 2.3
- Notes:
  - Configure CORS for approved origins only
  - Add CSP, frame protection, referrer policy, and content-type sniffing protections
  - Use secure cookie settings if cookies are used
 
### Task 7.6
 
- Title: Add audit logging and security review checklist
- Owner: Backend and QA
- Outcome: Sensitive flows are traceable and reviewed before release
- Dependencies: Task 2.5, Task 5.3, Task 7.4
- Notes:
  - Log auth events, token revocations, access denials, and critical record changes
  - Review IDOR, broken auth, CSRF, XSS, and secret exposure risks
 
### Task 7.7
 
- Title: Add dependency scanning and secret hygiene checks
- Owner: Platform
- Outcome: CI catches common supply-chain and secret management issues
- Dependencies: Task 1.5
- Notes:
  - Run dependency vulnerability scanning
  - Fail builds on committed secrets or insecure env handling
 
### Task 7.8
 
- Title: Prepare demo data and walkthrough flow
- Owner: Product and QA
- Outcome: Easy-to-review MVP demo path
- Dependencies: all earlier MVP tasks
 
## Parallelization Guidance
 
### Safe To Run In Parallel
 
- Task 1.1 and Task 1.2
- Task 3.2 and Task 3.3 after API contract is stable
- Task 4.3 and Task 4.4 after recurrence model is stable
- Task 5.3 and Task 5.4
- Task 6.2 and Task 6.4 once reminder event model is defined
- Task 7.1 and Task 7.2
 
### Keep Sequenced
 
- Domain model before endpoint implementation
- Endpoint contracts before frontend integration
- Recurrence rules before reminder worker
- Dose action semantics before reports and analytics
 
## Definition Of Done For Each Task
 
- Scope is limited and clear
- Inputs and outputs are documented
- Edge cases are noted
- Tests are identified or added
- Acceptance criteria are reviewable by another person
- Security and data ownership implications are identified
 
## Acceptance Criteria Template
 
- The task can be demoed independently
- The task has clear success and failure states
- The task does not introduce duplicate logic across frontend and backend
- The task uses approved DTOs and naming conventions
- Any date or reminder behavior is tested with explicit examples
- Any auth or data-changing behavior has authorization and validation coverage
 
 