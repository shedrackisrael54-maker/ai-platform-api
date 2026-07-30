# AI Platform API

NestJS modular monolith for the AI coding platform. See the architecture
spec for full context; this README covers local setup only.

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase/OpenAI/E2B/GitHub/Vercel/Stripe keys
npm run start:dev
```

Requires a local or hosted Redis instance for the BullMQ queues
(`REDIS_HOST`/`REDIS_PORT` in `.env`).

## Structure

- `src/modules/*` — one folder per domain (auth, projects, ai, sandbox,
  file-sync, preview, deployment, billing, realtime). Each is a
  self-contained NestJS module with its own controller/service.
- `src/modules/sandbox/providers/` — the `ISandboxProvider` interface
  plus the current E2B implementation. This is the seam where E2B can
  be swapped for self-hosted sandbox infra later without touching any
  other module.
- `src/queue/` — BullMQ queues and processors for everything
  long-running (sandbox boot, AI generation, deployment polling).
  Controllers enqueue jobs and return immediately; processors do the
  actual work and push progress over `RealtimeGateway`.
- `src/common/guards/jwt-auth.guard.ts` — applied globally; every route
  requires a valid Supabase JWT unless annotated `@Public()`.

## What's stubbed vs. real

Everything here is real, wired NestJS module structure — routes,
DTOs with validation, dependency injection are all functional. The
service method bodies are intentionally `throw new Error('Not
implemented')` stubs (marked with `// TODO`) so each module can be
filled in independently, per the milestone breakdown (M1–M9) in the
architecture spec, without the scaffolding changing shape later.

## Next steps (per milestone plan)

1. Wire real Supabase Auth calls into `AuthService` + JWKS verification
   into `JwtAuthGuard` (M1).
2. Implement `ProjectsService` against the `projects` table (M1).
3. Implement `AiOrchestratorService` + OpenAI tool-calling schema (M2).
4. Implement `E2bProvider` against the real E2B SDK (M3).
