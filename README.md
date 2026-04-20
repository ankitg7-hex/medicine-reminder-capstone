# Medicine Reminder App

A starter monorepo for the medicine reminder project with:

- a React frontend in `apps/frontend`
- a Node.js backend in `apps/backend`

This repo currently includes:

- Milestone 1 foundation
- Milestone 2 demo auth and profile flow
- frontend and backend test coverage for the current scaffold

## Project Structure

```text
capstone/
|-- apps/
|   |-- frontend/
|   |-- backend/
|-- docs/
|   |-- medicine-reminder/
|-- package.json
```

## Prerequisites

- Node.js `v22+`
- npm `v10+`

## Install Dependencies

From the project root:

```bash
npm install
```

## Start The Project

Open two terminals from the project root.

### Terminal 1: Start Backend

```bash
npm run dev:backend
```

The backend runs at:

```text
http://localhost:3001
```

Available starter endpoints:

- `GET /health`
- `GET /api/hello`
- `POST /api/auth/demo-login`
- `GET /api/me`
- `PATCH /api/me`

### Terminal 2: Start Frontend

```bash
npm run dev:frontend
```

The frontend runs at:

```text
http://localhost:5173
```

Open that URL in your browser after both servers are running.

## Run Tests

Run all tests from the project root:

```bash
npm test
```

Run frontend tests only:

```bash
npm run test --workspace frontend
```

Run backend tests only:

```bash
npm run test --workspace backend
```

## Build The Project

Run both builds from the project root:

```bash
npm run build
```

Run frontend build only:

```bash
npm run build --workspace frontend
```

Run backend build check only:

```bash
npm run build --workspace backend
```

## Current Demo Flow

1. Start backend and frontend.
2. Open `http://localhost:5173`.
3. Use the demo sign-in form.
4. Save the profile form after login.
5. Review the protected profile and starter schedule panel.

## Planning Docs

Project planning documents are available in:

- `docs/medicine-reminder/README.md`
- `docs/medicine-reminder/01-product-scope.md`
- `docs/medicine-reminder/02-architecture.md`
- `docs/medicine-reminder/03-implementation-backlog.md`
- `docs/medicine-reminder/04-agent-skill-plan.md`
