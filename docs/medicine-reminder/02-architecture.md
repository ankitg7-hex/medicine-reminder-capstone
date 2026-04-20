# Architecture Proposal

## Recommended Shape

- Frontend: React-based web app
- Backend: REST API service
- Database: relational database such as PostgreSQL
- Background processing: scheduled reminder worker or queue-backed job runner
- Notifications: start with in-app reminder state and a pluggable notification adapter for email, SMS, or push later

## Why This Shape

- A React frontend is quick to build, easy to demo, and flexible for dashboard-style healthcare UI.
- A REST backend keeps the domain model clear and easy to test.
- A relational database fits medication schedules, dose events, and reminder history well.
- A background worker keeps reminder generation and sending out of the request path.

## High-Level Modules

### Frontend Modules

- Authentication or profile onboarding
- Dashboard
- Medication management
- Schedule and reminders view
- Dose action flow
- History and reporting
- Settings

### Backend Modules

- Auth and user management
- Medication management
- Scheduling engine
- Dose tracking
- Reminder dispatch
- History and reporting
- Audit and safety messaging

## Proposed Domain Model

### User

- id
- full_name
- email or phone
- timezone
- created_at
- updated_at

### Medication

- id
- user_id
- name
- type
- dosage_value
- dosage_unit
- instructions
- reason
- start_date
- end_date
- status
- created_at
- updated_at

### MedicationSchedule

- id
- medication_id
- recurrence_type
- recurrence_rule
- reminder_time
- active
- created_at
- updated_at

### DoseEvent

- id
- user_id
- medication_id
- scheduled_at
- status
- action_taken_at
- source
- notes

### ReminderEvent

- id
- dose_event_id
- scheduled_send_at
- sent_at
- channel
- status
- provider_reference

## Core API Direction

### Auth And Profile

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `PATCH /me`

### Medications

- `GET /medications`
- `POST /medications`
- `GET /medications/:id`
- `PATCH /medications/:id`
- `DELETE /medications/:id`

### Daily Schedule

- `GET /schedule/today`
- `GET /schedule?date=YYYY-MM-DD`

### Dose Actions

- `POST /doses/:id/taken`
- `POST /doses/:id/missed`
- `POST /doses/:id/skipped`

### History

- `GET /history`
- `GET /history/summary`

## Reminder Processing Flow

1. Medication and schedule are created.
2. Backend generates upcoming dose events for a configurable window.
3. Worker scans due reminder events.
4. Worker sends or records reminder actions.
5. User marks a dose outcome.
6. Backend updates adherence state and history views.

## Key Technical Decisions To Confirm

- Frontend framework choice: Next.js or Vite React app
- Backend framework choice: Node.js with Express or NestJS, or Python with FastAPI
- Auth approach: full auth vs demo profile for first milestone
- Notification strategy for MVP: in-app only vs email/SMS mock adapter
- Job processing: cron-based worker vs queue worker

## Suggested MVP Stack

- Frontend: React with TypeScript
- Backend: Node.js with TypeScript
- API: Express or NestJS
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- UI: accessible component library plus custom dashboard styling

## Risks To Handle Early

- Timezone mistakes can break reminders.
- Recurrence rules can become complex very quickly.
- Notification channels can expand scope if not contained.
- Dose history integrity matters more than UI polish in healthcare-adjacent apps.
- Soft delete and audit behavior should be defined before implementation.

