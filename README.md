# training-api

Backend API for FIT.AI — a fitness tracking app with AI-powered workout plan generation.

**Stack**: Node.js 24 · Fastify 5 · Prisma 7 · PostgreSQL · Zod v4 · better-auth · Vercel AI SDK (Google Gemini 2.5 Flash)

---

## Getting started

### Prerequisites

- Node.js 24+
- pnpm 10+
- Docker (for local PostgreSQL)

### Setup

```bash
# 1. Start the database
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.exemple .env
# Edit .env with your values (see Environment Variables section)

# 4. Run migrations and generate Prisma client
pnpm prisma migrate dev
pnpm prisma generate

# 5. Start the dev server
pnpm dev
```

The API will be available at `http://localhost:8081`.
Interactive API docs (Scalar UI) at `http://localhost:8081/docs`.

---

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with hot reload (tsx --watch), port 8081 |
| `pnpm build` | Generate Prisma client + compile TypeScript |
| `pnpm prisma generate` | Regenerate Prisma client after schema changes |
| `pnpm prisma migrate dev` | Create and run a new migration |
| `pnpm eslint .` | Lint the codebase |

---

## Environment Variables

Copy `.env.exemple` to `.env` and fill in the values:

| Variable | Description |
|---|---|
| `PORT` | Server port (default `8080`) |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) |
| `BETTER_AUTH_SECRET` | Secret key for better-auth session signing |
| `API_BASE_URL` | This API's public base URL (default `http://localhost:8080`) |
| `WEB_APP_BASE_URL` | Frontend origin — used for CORS and auth trusted origins |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI API key for Gemini (AI trainer feature) |
| `OPENAI_API_KEY` | OpenAI API key (optional, alternative AI provider) |
| `NODE_ENV` | `development` \| `production` \| `test` |

All variables are validated at startup via Zod. The process exits immediately if a required variable is missing.

---

## API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/` | Health check | No |
| `GET` | `/docs` | Interactive API reference (Scalar) | No |
| `GET` | `/swagger.json` | OpenAPI specification | No |
| `GET/POST` | `/api/auth/*` | Authentication (sign-in, sign-out, OAuth, session) | — |
| `POST` | `/workout-plans` | Create workout plan (deactivates current active plan) | Yes |
| `GET` | `/workout-plans` | List all workout plans (`?active=true\|false`) | Yes |
| `GET` | `/workout-plans/:workoutPlanId` | Get workout plan with days | Yes |
| `GET` | `/workout-plans/:workoutPlanId/days/:workoutDayId` | Get workout day with exercises and sessions | Yes |
| `POST` | `/workout-plans/:workoutPlanId/days/:workoutDayId/sessions` | Start a workout session | Yes |
| `PATCH` | `/workout-plans/:workoutPlanId/days/:workoutDayId/sessions/:sessionId` | Complete a workout session | Yes |
| `GET` | `/home/:date` | Home screen data (active plan, today's day, streak, consistency map) | Yes |
| `GET` | `/stats` | Aggregated stats (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) | Yes |
| `GET` | `/me` | Current user's physical training data | Yes |
| `POST` | `/ai/` | AI personal trainer streaming chat | Yes |

---

## Architecture

### Layers

```
src/
├── routes/       # HTTP handlers — validation, auth checks, error mapping
├── usecases/     # Business logic — one class per use case, each with execute()
├── schemas/      # All Zod schemas for request/response validation
├── errors/       # Custom error classes (NotFoundError, ConflictError, etc.)
└── lib/          # Shared infrastructure (auth, db, env)
```

**Routes** handle only HTTP concerns: parsing the request, checking session, calling a use case, and mapping errors to status codes.

**Use Cases** contain all business logic. Each is a class with a single `execute(dto: InputDto): Promise<OutputDto>` method. They call Prisma directly, throw typed errors, and never catch them.

**Schemas** (`src/schemas/index.ts`) define all Zod v4 schemas consumed by Fastify's type provider and included in the OpenAPI output.

### AI Personal Trainer

The `POST /ai/` endpoint uses Vercel AI SDK v6 with `streamText`. The model is Google Gemini 2.5 Flash. The AI has access to 4 tools:

- `getUserTrainData` — read the user's physical stats (weight, height, body fat, age)
- `updateUserTrainData` — update physical stats
- `getWorkoutPlans` — list existing workout plans
- `createWorkoutPlan` — create a new full workout plan with days and exercises

The endpoint returns a streaming `UIMessageStreamResponse`, consumed directly by the frontend's `useChat` hook.

### Authentication

[better-auth](https://better-auth.com) with Google social login. Sessions are persisted via the Prisma adapter. In production, cookies are scoped to `.training-ai.site`.

---

## Database Schema

```
User
  ├── WorkoutPlan[]
  │   └── WorkoutDay[]
  │       ├── WorkoutExercise[]
  │       └── WorkoutSession[]
  ├── Session[]        (better-auth)
  ├── Account[]        (better-auth)
  └── Verification[]   (better-auth)
```

Key enums: `WeekDay` — `MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY`

Only one `WorkoutPlan` can be active per user at a time. Creating a new plan automatically deactivates the previous one.

---

## Conventions

- Use Case files: `PascalCase.ts` (e.g. `CompleteWorkoutSession.ts`)
- All other files: `kebab-case.ts`
- Conventional Commits for git messages
- Never return Prisma models directly — always map to OutputDto
- Arrow functions preferred; early returns over nesting; higher-order functions over loops
- Functions with more than 2 parameters take an object
- No code comments
