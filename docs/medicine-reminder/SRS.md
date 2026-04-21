# Software Requirements Specification
 
## Document Purpose
 
This Software Requirements Specification defines the functional and non-functional requirements for the Medicine Reminder App MVP. It is intended to align product, design, frontend, backend, QA, and security expectations before implementation and release.
 
## Product Overview
 
The Medicine Reminder App helps users manage medication schedules, receive reminders, track dose outcomes, and review adherence history in a simple and trustworthy experience.
 
The MVP is healthcare-adjacent, not diagnostic. The system must avoid providing treatment advice, dosage recommendations, or medical interpretations beyond user-authored medication records and reminder workflows.
 
## Goals
 
- Help users remember scheduled medication doses.
- Reduce missed or forgotten doses through timely reminders.
- Provide a clear daily schedule and dose history.
- Support secure, user-scoped access to medication and reminder data.
- Build a maintainable foundation for future enhancements such as caregiver support and richer notifications.
 
## In Scope For MVP
 
- User registration, login, logout, and profile management
- Medication CRUD with archive support
- Schedule definition using daily and selected-weekday recurrence
- Dose generation for today and an upcoming rolling window
- Daily schedule view with overdue and upcoming states
- Dose actions: taken, missed, skipped
- Medication and dose history
- Reminder event tracking and reminder dispatch foundation
- Basic dashboard summary cards
- Baseline security controls, auditability, and test coverage
 
## Out Of Scope For MVP
 
- Medical advice, diagnosis, or interaction checking
- Prescription OCR or barcode scanning
- Insurance, payments, and pharmacy integrations
- Advanced caregiver workflows
- Rich analytics beyond basic summaries
- Wearable integrations
- Multi-tenant organization support
 
## Stakeholders And Users
 
### Primary Users
 
- Individuals managing recurring medicines
- Family members assisting dependents or parents
 
### Internal Stakeholders
 
- Product owner
- Engineering team
- QA team
- Security reviewer
 
## Assumptions
 
- The application will be delivered as a web-based system with a React frontend and REST backend.
- MVP data access is user-scoped and requires authentication.
- Reminder delivery may start with in-app or mock notification handling before production-grade push or SMS integrations.
- All timestamps will be stored in UTC and presented in the user-selected timezone.
 
## System Context
 
The system consists of:
 
- A frontend web application for authentication, medication management, daily schedule, and history
- A backend API handling authentication, profile, medication management, scheduling, dose actions, and reminder workflows
- A relational database storing users, medications, schedules, dose events, reminder events, and session data
- A background worker or scheduled process for reminder generation and dispatch
 
## User Classes And Permissions
 
### Authenticated User
 
- Can manage only their own profile
- Can create, view, update, and archive only their own medications
- Can view and act on only their own dose events and reminders
- Can view only their own history and summary data
 
### Unauthenticated Visitor
 
- Can access only public health-check and authentication bootstrap endpoints
- Cannot access profile, medication, schedule, history, or reminder data
 
## Functional Requirements
 
### FR-1 Authentication
 
- The system shall allow a user to register with email, password, full name, and timezone.
- The system shall allow a user to log in with valid credentials.
- The system shall allow a user to log out of the current session.
- The system shall support session restoration for a valid active session.
- The system shall prevent unauthenticated access to protected application features and APIs.
- The system shall allow the user to update profile fields such as full name, email, and timezone.
 
### FR-2 Authorization
 
- The system shall derive authenticated identity from validated session or token context.
- The system shall scope all medication, schedule, dose, history, and reminder queries to the authenticated user.
- The system shall reject attempts to access or mutate resources owned by a different user.
 
### FR-3 Medication Management
 
- The system shall allow a user to create a medication plan with name, dosage, type, instructions, reason, start date, optional end date, recurrence type, reminder times, and weekdays if applicable.
- The system shall allow a user to edit an existing medication plan.
- The system shall allow a user to archive a medication plan instead of hard deletion.
- The system shall list active medications by default.
- The system may allow archived medications to be included through filtering.
 
### FR-4 Schedule Configuration
 
- The system shall support at least two recurrence types in MVP: `daily` and `selected weekdays`.
- The system shall allow one or more reminder times per medication.
- The system shall validate that at least one reminder time is present.
- The system shall validate that end date is not earlier than start date.
- The system shall validate that at least one weekday is selected when weekday recurrence is used.
 
### FR-5 Dose Event Generation
 
- The system shall generate dose events for eligible active medications.
- The system shall generate today’s schedule on demand and may generate an upcoming rolling window for reminders.
- The system shall avoid duplicate dose events for the same medication schedule and scheduled time.
- The system shall stop generating dose events for archived or ended medication plans.
 
### FR-6 Daily Schedule
 
- The system shall show the authenticated user a daily list of dose events.
- The system shall display dose states including upcoming, overdue, taken, missed, and skipped.
- The system shall display medication name, dosage, schedule time, and relevant instructions for each scheduled dose.
- The system shall provide empty-state messaging when no doses are scheduled.
 
### FR-7 Dose Actions
 
- The system shall allow the user to mark a dose as taken.
- The system shall allow the user to mark a dose as missed.
- The system shall allow the user to mark a dose as skipped.
- The system shall record an action timestamp for each dose action.
- The system shall persist dose status changes for history and reporting.
 
### FR-8 History And Dashboard
 
- The system shall present dose history to the authenticated user.
- The system shall include status and action timestamp in history records.
- The system shall provide summary counts for daily dose states such as upcoming, overdue, and taken.
- The system should support filtering history by medication, status, and date range.
 
### FR-9 Reminder Processing
 
- The system shall maintain reminder records separately from dose status records.
- The system shall track reminder delivery status such as queued, sent, delivered, and failed.
- The system shall support a background process that identifies due reminder events.
- The system shall support a pluggable notification adapter so reminder delivery channels can evolve without changing core scheduling logic.
 
### FR-10 Auditability
 
- The system shall retain dose action timestamps.
- The system shall log authentication failures, authorization denials, and sensitive state changes.
- The system shall preserve enough audit data to trace medication and dose workflow changes during support and testing.
 
## External Interface Requirements
 
### User Interface Requirements
 
- The UI shall support desktop and mobile-friendly layouts.
- The UI shall use clear labels and accessible forms for medication and schedule entry.
- The UI shall surface validation failures in understandable user-facing language.
- The UI shall make primary actions such as sign in, save medication, and mark dose taken easy to find.
 
### API Requirements
 
- The backend shall expose REST endpoints for auth, profile, medications, schedule, doses, history, and reminder-related operations.
- The backend shall return JSON request and response payloads.
- The backend shall use a consistent error response shape for validation and authorization failures.
 
### Data Requirements
 
- The system shall store timestamps in UTC.
- The system shall retain user timezone for presentation and scheduling boundaries.
- The system shall soft-archive medication plans instead of permanently deleting active care records.
 
## Non-Functional Requirements
 
### NFR-1 Security
 
- The system shall hash passwords using a strong adaptive algorithm such as Argon2id or bcrypt.
- The system shall protect authenticated routes using secure session or token validation.
- The system shall use secure refresh-token or session management with expiry and revocation.
- The system shall validate all request payloads before business logic execution.
- The system shall use rate limiting on authentication-sensitive endpoints.
- The system shall restrict CORS to approved frontend origins.
- The system shall apply baseline browser security headers.
- The system shall not expose stack traces or internal implementation details in production error responses.
 
### NFR-2 Privacy And Data Handling
 
- The system shall minimize stored personal data to what is required for reminder and profile workflows.
- The system shall avoid storing unnecessary sensitive health content in MVP.
- The system shall keep secrets outside source control.
 
### NFR-3 Reliability
 
- The system should continue to serve core CRUD and schedule APIs during reminder worker retries or transient notification failures.
- The system shall avoid duplicate dose generation for the same schedule instance.
- The system should support safe retry behavior for reminder dispatch.
 
### NFR-4 Performance
 
- Core dashboard and daily schedule views should load within acceptable interactive time for normal MVP dataset sizes.
- Medication list, schedule, and history queries should return efficiently for a single user’s typical medication load.
 
### NFR-5 Usability And Accessibility
 
- The system shall support keyboard-accessible forms and controls.
- The system shall present large readable schedule information and clear action labels.
- The system shall work on common mobile and desktop viewport sizes.
 
### NFR-6 Maintainability
 
- The frontend and backend shall use shared contracts or clearly aligned DTOs.
- Scheduling logic shall remain on the backend to avoid inconsistent duplicate logic.
- The codebase shall include test coverage for critical auth, scheduling, and dose workflows.
 
## Data Entities
 
### User
 
- id
- full_name
- email
- password_hash
- timezone
- email_verified_at
- last_login_at
- failed_login_count
- locked_until
- created_at
- updated_at
 
### Session
 
- id
- user_id
- refresh_token_hash
- device_name
- ip_address
- user_agent
- expires_at
- revoked_at
- created_at
 
### Medication
 
- id
- user_id
- name
- dosage
- type
- instructions
- reason
- start_date
- end_date
- recurrence_type
- reminder_times
- weekdays
- status
- created_at
- updated_at
- archived_at
 
### DoseEvent
 
- id
- user_id
- medication_id
- scheduled_at
- scheduled_date
- scheduled_time
- status
- action_taken_at
- notes
 
### ReminderEvent
 
- id
- dose_event_id
- scheduled_send_at
- sent_at
- channel
- status
- provider_reference
 
## Business Rules
 
- A medication must have a name, dosage, start date, recurrence type, and at least one reminder time.
- A medication with weekday recurrence must include at least one valid weekday.
- End date cannot be earlier than start date.
- Archived medications cannot generate new dose events.
- Only the owner of a medication or dose event may read or update it.
- Dose status and reminder delivery status must remain separate concerns.
 
## Constraints
 
- MVP recurrence support is intentionally limited to daily and selected weekdays.
- Reminder channels may begin as in-app or mock implementations.
- The product must avoid medical recommendation behavior.
 
## Acceptance Criteria Summary
 
- A user can register, log in, and access only their own data.
- A user can create and edit medication plans with schedule details.
- The system generates and displays today’s schedule from saved plans.
- A user can mark doses as taken, missed, or skipped.
- Dose outcomes appear in history and summary views.
- Reminder processing is modeled cleanly enough to support worker-based dispatch.
- Baseline security and validation controls are present for MVP release.
 
## Open Questions
 
- Will email verification be included in MVP or deferred?
- Will password reset be included in MVP or deferred?
- Which reminder channel is the initial production path: in-app only, email, SMS, or push?
- What is the expected retention window for reminder and audit records?
 
 