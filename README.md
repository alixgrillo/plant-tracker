# Plant Tracker

Mobile app to register and care for indoor plants. Phase 1: register plants (with optional photo) and get AI-generated care info. Phase 2: watering calendar and reminders.

## Structure
- `apps/mobile` – Expo / React Native (TypeScript)
- `apps/api` – Fastify API (OpenAI identification, JWT-verified via Supabase)
- `packages/shared` – Zod schemas and shared types
- `supabase` – SQL migrations and RLS policies
- `docs/architecture.md` – design overview

After an AI identification, the API compares a simple scientific species name with USDA PLANTS.
The comparison uses the USDA site's undocumented search and profile services, so it may be
unavailable or change without notice. A listed name does not verify the photo identification,
and a missing name does not mean the plant is invalid. The comparison is displayed during
identification and is not saved with the plant.

For low- or medium-confidence identifications, the app offers up to three AI-suggested
lookalikes. Reference photos are retrieved by exact species name from iNaturalist and are
shown only when a CC BY or CC0 photo with attribution is available; they are illustrative,
not proof of identification. Photo lookup sends the suggested species name to iNaturalist,
and displaying a photo loads it from iNaturalist's image host. Choosing an alternative
requests new AI-generated care for that species. Reference photos and alternatives are
not saved with the plant.

Watering and fertilizing actions are stored as separate events. The next due date is
the latest action's local calendar date plus the current interval, even when the action
was early or late. New events also snapshot the recommended intervals and watering
override in effect at the time, for future history analysis. Older events cannot be
backfilled reliably and retain empty snapshots. Apply the Supabase migrations to enable
the snapshots.

## Getting started
1. `npm install`
2. Copy `.env.example` to `.env` (API) and copy the `EXPO_PUBLIC_*` values into `apps/mobile/.env`
3. `npm run dev -w apps/api` and `npm start -w apps/mobile`

### Password recovery setup

The sign-in screen supports password reset using an emailed one-time code. In the Supabase
dashboard, open **Authentication > Email Templates > Reset password** and set the template
body to the contents of `supabase/templates/password-recovery.html`. The template must include
`{{ .Token }}`; the default reset-link-only email will not work with this code-based flow.
Check your Supabase email provider and rate limits before use. After requesting a code, enter
it in the app, choose a new password, and sign in. If the app is closed after code verification
but before the password is changed, request a new code.

