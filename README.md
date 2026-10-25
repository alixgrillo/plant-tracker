# Plant Tracker

Mobile app to register and care for indoor plants. Phase 1: register plants (with optional photo) and get AI-generated care info. Phase 2: watering calendar and reminders.

## Structure
- `apps/mobile` – Expo / React Native (TypeScript)
- `apps/api` – Fastify API (OpenAI identification, JWT-verified via Supabase)
- `packages/shared` – Zod schemas and shared types
- `supabase` – SQL migrations and RLS policies
- `docs/architecture.md` – design overview

## Getting started
1. `npm install`
2. Copy `.env.example` to `.env` (API) and copy the `EXPO_PUBLIC_*` values into `apps/mobile/.env`
3. `npm run dev -w apps/api` and `npm start -w apps/mobile`

