# Deploying Plant Tracker (API on Render, app on iPhone)

## 1. Put the code on GitHub
1. Create a **private** repo at github.com/new (no README).
2. From `plant-tracker`:
   ```
   git add -A
   git commit -m "Plant tracker"
   git remote add origin https://github.com/<you>/plant-tracker.git
   git push -u origin HEAD
   ```
   `.env` is git-ignored, so your keys are not uploaded.

## 2. Deploy the API on Render (free)
1. Sign up at render.com with GitHub.
2. **New > Blueprint**, pick the repo. Render reads `render.yaml`.
3. Fill in the three secrets when prompted: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same values as your local `.env`).
4. After it deploys, open `https://<your-service>.onrender.com/health`. You should see `{"ok":true}`.

Note: the free tier sleeps after ~15 minutes idle, so the first request after a break takes ~30-60s.

## 3. Point the app at it
In `apps/mobile/.env`, set:
```
EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com
```

## 4a. Try it now: Expo Go (free)
Install **Expo Go** from the App Store, run `npm start -w apps/mobile`, and scan the QR code. Works away from your computer only while the dev server runs, and notifications are limited in Expo Go.

## 4b. Standalone app: TestFlight (needs $99/yr Apple Developer account)
```
npm install -g eas-cli
cd apps/mobile
eas login
eas build:configure
eas build --platform ios --profile production
eas submit --platform ios
```
Set the three `EXPO_PUBLIC_*` values as EAS environment variables (`eas env:create`) since `.env` isn't uploaded. Then install via the TestFlight app on your iPhone.
