# Product Scope

## Vision

Build a simple, reliable medicine reminder app that helps users remember doses, track adherence, and review their daily medication schedule in a clean and low-friction experience.

## Product Goals

- Help users remember scheduled medication doses.
- Make daily medication tracking easy for non-technical users.
- Support a safe healthcare-adjacent experience without giving medical advice.
- Create a codebase that can grow into caregiver support, refill tracking, and reporting later.

## Core Users

- Individual users managing regular medication schedules.
- Family members helping parents or dependents track medication.
- Users who want a lightweight adherence tracker rather than a complex healthcare platform.

## MVP Scope

### Included

- User account or lightweight user profile support
- Add, edit, and archive medicines
- Define dosage instructions
- Configure one or more reminder times per day
- Set a medicine course with start date and optional end date
- View today's medication list
- Mark doses as taken, missed, or skipped
- View medication history
- Basic dashboard cards for upcoming, completed, and missed doses
- Basic notification/reminder mechanism

### Excluded From MVP

- Prescription scanning
- OCR or barcode support
- Advanced caregiver workflows
- AI insights
- Drug interaction checks
- Cloud-scale analytics
- Payments or insurance features
- Wearable integrations

## Functional Feature Inventory

### Medication Management

- Create a medication record
- Edit medication details
- Soft delete or archive a medication
- Add medication type
- Add dosage amount and unit
- Add notes such as before food or after food
- Add treatment reason
- Add start and end dates

### Scheduling

- Set one or many reminder times in a day
- Choose recurrence pattern
- Support daily schedules in MVP
- Leave room for weekly and interval schedules later
- Pause and resume medication plans
- Stop reminders when the course ends

### Dose Tracking

- Show scheduled doses for the current day
- Mark dose as taken
- Mark dose as missed
- Mark dose as skipped
- Store actual completion timestamp
- Show overdue doses

### History And Reporting

- Daily and historical dose logs
- Filter history by medication
- Show adherence summary cards
- Weekly adherence in post-MVP

### Notification Support

- Trigger reminders at scheduled times
- Mark reminders as pending, sent, acknowledged, or completed
- Retry or escalate if no action is taken
- Keep the initial notification strategy simple and platform-appropriate

## Non-Functional Expectations

- Simple and accessible interface
- Large, readable medication schedule UI
- Basic auditability of taken and missed doses
- Timezone-aware scheduling
- Safe wording and disclaimer support
- Data model that supports future mobile and web expansion

## Phased Roadmap

### Phase 1: Foundation

- Finalize stack
- Set up frontend and backend projects
- Create shared API contract
- Establish database schema and seed data strategy

### Phase 2: MVP Medication Workflow

- Build authentication or user profile flow
- Build medication CRUD
- Build daily schedule and dose tracking
- Build reminder processing flow

### Phase 3: MVP Polish

- Improve dashboard
- Add history filters
- Improve form validation and error states
- Add accessibility and responsive QA

### Phase 4: Post-MVP

- Refill tracking
- Caregiver notifications
- Export reports
- Multi-profile support
- Calendar and adherence analytics

