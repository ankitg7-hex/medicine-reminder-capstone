# Software Requirements Specification

## Document Purpose

This Software Requirements Specification defines the current functional and non-functional requirements for the Medicine Reminder App as implemented and intended for continued hardening.

This version supersedes the older demo-oriented planning assumptions. The current product includes persistent account-based authentication, SQLite-backed data storage, a tabbed dashboard, medication management, schedule generation, reminder processing, device registration, and audit activity.

## Product Overview

The Medicine Reminder App helps authenticated users manage medication plans, review a daily schedule, track dose outcomes, and monitor reminder activity in a clean web interface.

The application is healthcare-adjacent. It is not intended to diagnose, prescribe, or provide medical advice. Users manage their own medication records, reminders, and related account details.

## Product Goals

- Help users remember and act on scheduled medication doses.
- Provide secure, user-scoped access to medication and reminder data.
- Keep the daily medication plan easy to understand.
- Allow users to review adherence history and reminder activity.
- Persist account and medication data locally using SQLite for reliable local development and usage.

## In Scope

- User signup with username, email, password, and timezone
- User login and logout
- Session restoration for valid active token
- Profile management for username, email, and timezone
- Medication create, list, update, and archive
- Schedule definition with daily and selected-weekday recurrence
- Dose event generation for today and rolling window logic
- Daily schedule board grouped by dose state
- Dose actions: taken, missed, skipped
- Reminder event tracking and reminder processing
- Device registration and reminder channel switching
- Audit log timeline
- Overview dashboard and tab-based navigation
- SQLite-backed persistent storage for all core entities

## Out Of Scope

- Prescription verification or doctor workflow integration
- Medication interaction checking
- Insurance or pharmacy integration
- Email verification
- Password reset flow
- Multi-user household sharing
- Real push/SMS/email delivery integrations beyond the current internal reminder processing model
- Native mobile apps

## Users And Roles

### Primary User

- A signed-in individual managing their own medications and reminders

### Unauthenticated Visitor

- A visitor who can access signup and login only

## Technology Context

The current system consists of:

- A React frontend
- A Node.js backend
- SQLite persistent storage
- REST-style JSON API endpoints
- Internal reminder processing logic

## Functional Requirements

### FR-1 Authentication

- The system shall allow a user to create an account with `username`, `email`, `password`, and `timezone`.
- The system shall allow a user to sign in with valid `email` and `password`.
- The system shall allow a user to sign out of the current session.
- The system shall restore a valid session when a stored active token is present.
- The system shall reject protected requests when the user is not authenticated.

### FR-2 Profile Management

- The system shall allow the authenticated user to view their own profile.
- The system shall allow the authenticated user to update `username`, `email`, and `timezone`.
- The system shall prevent duplicate username or email use across accounts.
- The system shall keep the profile timezone available for schedule and reminder presentation.

### FR-3 Authorization And Data Isolation

- The system shall scope all protected data access to the authenticated user.
- The system shall ensure a user can access only their own medications, schedules, doses, reminders, devices, and audit records.
- The system shall return authorization failure for unauthenticated access attempts.

### FR-4 Medication Management

- The system shall allow the authenticated user to create a medication plan.
- The system shall allow the authenticated user to update an existing medication plan.
- The system shall allow the authenticated user to archive a medication plan.
- The system shall list active medications by default.
- The system may support archived medication retrieval through filtered backend access.

Medication data shall include:

- name
- type
- dosage
- instructions
- reason
- start date
- optional end date
- recurrence type
- reminder times
- weekdays when recurrence requires them

### FR-5 Schedule Configuration

- The system shall support `daily` recurrence.
- The system shall support `selected-weekdays` recurrence.
- The system shall allow one or more reminder times for a medication plan.
- The system shall validate schedule input before persistence.

Validation shall include:

- medication name required
- dosage required
- valid start date required
- valid end date when provided
- end date not earlier than start date
- at least one reminder time
- valid weekday selection for weekday recurrence

### FR-6 Dose Event Generation

- The system shall generate dose events for active medication schedules belonging to the authenticated user.
- The system shall avoid duplicate dose event generation for the same schedule slot.
- The system shall stop generating new active dose events for archived medications.
- The system shall use the user's timezone when computing today and upcoming schedule windows.

### FR-7 Daily Schedule

- The system shall present a daily schedule page for the authenticated user.
- The schedule shall group dose events into:
  - due now
  - upcoming
  - completed
  - missed
  - skipped
- Each schedule entry shall show medication name, time, dosage, and available instructions.

### FR-8 Dose Actions

- The system shall allow the user to mark a dose as completed.
- The system shall allow the user to mark a dose as missed.
- The system shall allow the user to mark a dose as skipped.
- The system shall persist action timestamp and optional notes.
- The system shall reflect the updated dose state in schedule and history views.

### FR-9 History

- The system shall provide a history view for previously acted-on doses.
- The history view shall support filtering by medication.
- The history view shall support filtering by outcome status.
- The history view shall display summary counts for completed, missed, skipped, and total.

### FR-10 Reminders

- The system shall maintain reminder events separately from dose events.
- The system shall track reminder status values including `queued`, `sent`, `delivered`, and `failed`.
- The system shall allow reminder processing through a backend action.
- The system shall support device registration and switch queued reminder channel behavior based on device availability.
- The system shall allow stale reminders to contribute to missed-dose transitions according to backend rules.

### FR-11 Device Registration

- The system shall allow the authenticated user to register a device token.
- The system shall store device name and platform metadata.
- The system shall show registered devices in the reminder page.

### FR-12 Activity Timeline

- The system shall record significant account and domain actions in an audit timeline.
- The system shall expose recent user-scoped activity to the authenticated user.
- The system shall include events such as:
  - signup
  - login
  - profile update
  - medication create/update/archive
  - dose update
  - device registration
  - reminder processing

### FR-13 Navigation And Dashboard

- The system shall show an Overview page by default after sign-in.
- The system shall expose a top menu for feature pages.
- The system shall render only the selected feature page when the user changes tabs.
- The sign-out action shall be available at the right side of the top menu.

## User Interface Requirements

- The signed-out experience shall support both sign-in and sign-up forms.
- The signed-in experience shall provide a clear top navigation menu.
- The interface shall support desktop and mobile layouts.
- The interface shall show meaningful empty states when no medication, reminder, or history data exists.
- The interface shall avoid exposing technical implementation details such as internal endpoint lists in user-facing screens.

## API Requirements

The backend shall expose JSON APIs for:

- health
- auth signup
- auth login
- auth logout
- profile read/update
- medication CRUD
- schedule retrieval
- dose update
- history retrieval
- reminder retrieval and processing
- device registration
- audit log retrieval

The backend shall:

- return JSON responses
- return consistent error messages for validation failures
- return `401` for unauthenticated protected access
- avoid leaking internal stack traces in normal error responses

## Data Requirements

### Persistent Storage

- The system shall persist data in SQLite.
- The local database file shall be kept outside version control.

### Core Entities

#### User Profile

- id
- username
- email
- password_hash
- timezone
- created_at
- updated_at

#### Session

- token
- user_id
- created_at

#### Medication

- id
- user_id
- name
- type
- dosage
- instructions
- reason
- start_date
- end_date
- status
- created_at
- updated_at
- archived_at

#### Schedule

- id
- medication_id
- user_id
- recurrence_type
- weekdays
- times
- active
- created_at
- updated_at

#### Dose Event

- id
- user_id
- medication_id
- schedule_id
- scheduled_at
- status
- action_taken_at
- notes
- history
- source

#### Reminder Event

- id
- user_id
- dose_event_id
- scheduled_send_at
- channel
- status
- provider_reference
- sent_at
- delivered_at
- failed_at
- created_at
- updated_at

#### Device Registration

- id
- user_id
- token
- device_name
- platform
- created_at
- last_seen_at

#### Audit Log

- id
- type
- user_id
- details
- recorded_at

## Business Rules

- Email addresses shall be normalized before account matching.
- Usernames shall be unique.
- Email addresses shall be unique.
- Passwords shall be hashed before storage.
- Archived medications shall not remain active for future schedule generation.
- Reminder state and dose state shall remain separate concepts.
- Dose actions shall be recorded only for the authenticated owner of the dose.

## Non-Functional Requirements

### NFR-1 Security

- Passwords shall not be stored in plain text.
- Protected routes shall validate bearer token session identity.
- The system shall apply baseline browser security headers.
- The system shall validate incoming request payloads.
- The system should add auth rate limiting in a future hardening phase.

### NFR-2 Reliability

- Core data shall persist across backend restarts through SQLite storage.
- Dose generation shall be idempotent for the same schedule and time slot.
- Reminder processing shall not corrupt dose ownership or user boundaries.

### NFR-3 Performance

- The application should provide acceptable responsiveness for local single-user workloads and typical personal medication datasets.

### NFR-4 Maintainability

- Scheduling logic shall remain on the backend.
- Auth, medication, schedule, history, and reminder flows shall remain separated by clear endpoint boundaries.
- Critical flows shall be testable through backend integration tests and frontend type or UI checks.

### NFR-5 Usability

- Primary actions such as sign in, create account, save medication, and mark dose taken shall be easy to locate.
- Overview shall act as the default dashboard page after sign-in.
- Navigation labels shall be understandable to non-technical users.

## Acceptance Summary

The product satisfies the current release intent when:

- A user can create an account and sign in later with the same credentials.
- Account, medication, reminder, and history data persist through SQLite storage.
- A user can manage only their own records.
- A user can add medication plans and see generated daily schedule items.
- A user can update dose outcomes and see them in history.
- A user can register devices and review reminder activity.
- The overview dashboard and tabbed feature navigation work as expected.

## Known Gaps And Future Work

- Password reset flow is not yet implemented.
- Email verification is not yet implemented.
- Rate limiting and stronger auth hardening are still recommended.
- The current token storage approach in the frontend should be reviewed before public deployment.
- External reminder delivery providers are not yet integrated.
