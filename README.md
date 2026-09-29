# Rehab

An iPhone app for following a prescribed rehabilitation programme. Open your daily plan, read all the exercises, move at your own pace, and record how you feel.

**V1 is built for a private trial.** Programme management is API-only. There is no follow-along player, timer, programme builder, or chatbot.

## Run locally

Requires Node 24 and Docker (or PostgreSQL 17).

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run account:create -- "Your name"
npm run dev:api
```

Account creation prints a user ID and a personal token once. Keep the token; only its SHA-256 hash is stored in PostgreSQL. Re-running creates a new account; pass an existing user ID as the second argument to issue a replacement token for that account.

In a second terminal, create sample data **through the API**:

```bash
read -rsp 'Personal token: ' API_TOKEN
export API_TOKEN
npm run seed
unset API_TOKEN
npm run dev:web
```

Open **http://localhost:8081**, connect to **http://localhost:3000**, and paste your token. The seed creates a six-week programme starting today, four daily sessions, six exercises and a daily check-in. It deliberately creates no historical completions or symptom scores. These sample prescriptions demonstrate the app; replace them with your existing plan for a real rehab trial.

For a preview that keeps running after you close the terminal, stop any foreground API/Expo servers and run `npm run preview:up`. This builds the web app and starts the API, static preview and PostgreSQL as detached Docker containers with automatic restarts. It uses the same local database and tokens. Run `npm run preview:up` again after code changes, or `npm run preview:down` before returning to the development servers. The persistent browser preview binds to this computer’s loopback interface; use the development server instructions below for a phone on your LAN.

For iPhone development:

```bash
npm run start -w @rehab/mobile -- --go
```

If the installed Expo Go version supports SDK 57, open the QR code. Otherwise use the EAS development/preview build described in [Deployment](docs/deployment.md). On your phone, the API address must be your computer’s LAN IP (e.g. `http://192.168.1.20:3000`), with both devices on the same network. `localhost` on the phone means the phone itself. Native reminders need the iPhone app; the browser is a functional UI preview.

## What works

- Today, calendar navigation, programme phases, complete exercise lists and expandable instructions.
- Complete, skip and undo a session. Exercise completion is recorded for every exercise when the session is completed.
- Generic numeric, boolean, single-choice, multiple-choice and text assessments; daily, weekly, programme-boundary and post-session triggers.
- Adherence, programme progress, symptom charts, and full check-in history.
- Local iOS reminders, notification navigation/actions, snooze, per-occurrence reminder changes, and notification preferences.
- Immediate durable local writes, optimistic UI, sequential retry-safe sync, and offline access to cached plans.
- Token-authenticated API, account isolation, immutable programme/assessment revisions, and Swagger/OpenAPI.

## Project layout

| Path                   | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `apps/mobile`          | Expo SDK 57, React Native, Expo Router, TanStack Query      |
| `apps/api`             | Fastify, Zod, PostgreSQL via `pg`                           |
| `packages/core`        | Shared schemas, types, recurrence and assessment validation |
| `scripts/seed.ts`      | Repeat-safe sample programme creation via HTTP              |
| `docs/deployment.md`   | Railway + iPhone trial steps                                |
| `docs/architecture.md` | Persistence, revisions, offline and reminder semantics      |
| `docs/design.md`       | Mobbin research and design decisions                        |

## API

Interactive docs: **http://localhost:3000/docs**. Machine-readable definition: **http://localhost:3000/openapi.json**. All data endpoints require `Authorization: Bearer <token>`.

See [API examples](docs/api.md) for creation, schedule changes and progress queries. The OpenAPI request schemas are generated from the same Zod contracts used by the server. A trusted server operator bootstraps the first token; authenticated clients can issue and revoke additional tokens.

## Verification

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build:api
cd apps/mobile
npx expo-doctor
npx expo export --platform all
```

API tests use the configured PostgreSQL database and create/clean up isolated test accounts. Browser tests start the API and Expo web server if needed, create their own account, and test completion and check-in persistence through an offline reload and subsequent sync. Install a browser with `npx playwright install chromium` if Chromium is not already installed; `CHROMIUM_PATH` can override its location.

## Trial boundaries

- Native iOS signing, installation, notification permission/delivery and cold-start navigation still need verification on a physical iPhone. Successful JS export is not a signed native build.
- Offline data includes up to two years of history and the next 14 days. Open the app while connected regularly to refresh it. Sync runs while the app is open or returning to the foreground; there is no background sync service.
- Up to 60 upcoming local reminders are queued, shared by sessions and scheduled check-ins. They are replenished when the app syncs. Server changes reach notifications after the app next connects.
- Exercise images are cached when viewed. External videos need connectivity.
- App changes to reminder time affect one occurrence. Change a recurring schedule through the programme revision API.
- Conflicting/stale offline changes stay queued with an explicit error in Settings; they are never silently discarded. See [conflicts](docs/architecture.md#conflicts).
- Account data remains cached on the device after disconnecting, scoped to the account and server. The token is removed. Uninstalling the app removes the local cache and unsynced data; a browser cache clear does the same.

[Deploy the API and install the iPhone trial →](docs/deployment.md)
