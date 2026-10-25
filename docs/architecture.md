# Plant Tracker – Initial Architecture Plan

## Problem
New mobile-first app (new GitHub repo, folder `c:\code-alix\plant-tracker`) for tracking indoor plants.
- Phase 1: multi-user login; register a plant (name, optional photo); AI (OpenAI vision) identifies species and returns care info (light, water range, how to tell it's healthy).
- Phase 2: calendar showing when each plant needs watering (plus push reminders).

## Decisions
- Mobile: React Native + Expo (TypeScript), Expo Router, iOS+Android from one codebase.
- Backend: **hybrid** - Supabase (Postgres, Auth, Storage, Row Level Security) + a thin Node/TypeScript API (Fastify) that owns the OpenAI calls. Rationale: you know Node/TS; Supabase removes the work of building auth, DB hosting and image storage by hand; the API keeps the OpenAI key off the device.
- AI: OpenAI vision model with structured (JSON-schema) output.
- Monorepo (npm workspaces) so mobile and API share types and Zod schemas.

## Repo layout
```
plant-tracker/
  apps/mobile/        Expo app (screens, camera/picker, calendar)
  apps/api/           Fastify API (/identify, later /schedule jobs)
  packages/shared/    Zod schemas + TS types (Plant, CareProfile)
  supabase/           migrations, RLS policies, config
  docs/               architecture.md, ADRs
  .github/workflows/  CI (lint, typecheck, test)
  README.md, .gitignore, .env.example
```

## Data model (Postgres)
- `plants`: id, user_id, nickname, species_common, species_scientific, photo_path, location, acquired_on, notes, created_at
- `care_profiles`: plant_id, light, water_min_days, water_max_days, water_notes, health_signs, description, source (ai/manual), model, created_at (editable by user; AI output is a suggestion)
- Phase 2: `watering_events` (plant_id, watered_at), plus `next_water_due` derived from last event + interval; `reminder_prefs`/`push_tokens`.
- RLS: every table restricted to `auth.uid() = user_id`; Storage bucket private per-user folder.

## Key flows
1. Register: user picks/takes photo -> upload to Supabase Storage (resized client-side) -> app calls `POST /identify` with JWT + image path -> API verifies JWT, fetches image, calls OpenAI -> returns species guess(es) + care profile (validated by Zod) -> user confirms/edits -> saved to DB.
2. Phase 2: calendar view from `next_water_due`; "mark watered" writes event; scheduled job (Supabase cron/Edge or API cron) + Expo push notifications.

## Security/cost notes
- OpenAI key only on server; per-user rate limiting on `/identify`; image size limit; show confidence and let user correct species.
- Treat AI care info as guidance, not authoritative; allow manual override.

## Todos
1. scaffold-repo: Create `plant-tracker` folder, git init, npm workspaces, TS config, eslint/prettier, .gitignore, README.
2. shared-package: `packages/shared` with Zod schemas/types.
3. supabase-setup: Supabase project + local CLI, migrations for plants/care_profiles, RLS, storage bucket.
4. api-identify: Fastify app, JWT verification, `/identify` using OpenAI vision with structured output, rate limit, tests with mocked OpenAI.
5. mobile-shell: Expo app, navigation, Supabase auth (sign up/in), plant list screen.
6. mobile-register-plant: photo capture/pick, upload, call `/identify`, confirm/edit form, save.
7. plant-detail: detail screen showing care info and edit.
8. ci-docs: GitHub Actions (lint/typecheck/test), docs/architecture.md, .env.example.
9. phase2-calendar (later): watering_events, calendar UI, push reminders.

Dependencies: shared-package -> api-identify, mobile-*; supabase-setup -> mobile-shell, api-identify; mobile-shell -> mobile-register-plant -> plant-detail.

## Open items
- Hosting for the API (e.g. Render/Fly/Railway) - decide at deploy time.
- Needs: Supabase account, OpenAI API key, Expo account (later for builds).
