# Railway and iPhone deployment

The API is deployed to the **mehab** Railway project. Apple/Expo account setup, signing and iPhone installation are the remaining steps.

You need an Expo account and an active paid Apple Developer Program membership for the signed iPhone preview. A GitHub repository is optional for CLI deployment. EAS builds the iOS app in the cloud, so you can run these steps from Linux. The preview installs as its own Rehab app and runs without your laptop. This project uses SDK 57; the App Store edition of Expo Go does not support that SDK. See [Expo Go compatibility](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/).

## 1. Railway API + PostgreSQL

The existing deployment uses:

- [Railway project dashboard](https://railway.com/project/6b166b6a-1723-43b7-b171-1225d9f2fca2), environment `production`.
- `Postgres`: Railway PostgreSQL with its persistent volume.
- `rehab-api`: the root Dockerfile, connected through `${{Postgres.DATABASE_URL}}` on Railway's private network.
- API URL: `https://rehab-api-production-e09b.up.railway.app`.
- [Health](https://rehab-api-production-e09b.up.railway.app/health), [interactive API docs](https://rehab-api-production-e09b.up.railway.app/docs), [OpenAPI schema](https://rehab-api-production-e09b.up.railway.app/openapi.json).

`.railway/railway.ts` replaces the deprecated `railway.json`. It declares only the API service; the existing database and volume remain separately managed. It sets the migration command, health check, Docker builder, restart policy and environment variables. Keep service variables in that file: applying IaC can remove variables omitted from the declaration. Never put literal credentials there.

From a new checkout, install dependencies and link the existing service:

```bash
npm ci
railway login
railway link --project 6b166b6a-1723-43b7-b171-1225d9f2fca2 --environment production --service rehab-api
```

To apply infrastructure changes, review the plan before applying it:

```bash
railway config plan
railway config apply
```

Deploy from the **repository root**, not `apps/api`:

```bash
railway up --service rehab-api --detach
railway deployment list --service rehab-api
```

The migration runs before deployment, and `/health` must pass before traffic reaches the new instance. The API listens on `0.0.0.0:3000`. Browser requests from `http://localhost:8081` and `http://127.0.0.1:8081` are allowed; native iPhone requests do not need a CORS origin.

### Account and trial data

The deployed account credentials are saved locally in `.railway/credentials.local.json`, excluded from Git and Docker uploads and readable only by your OS user. Use its `apiUrl` and `token` fields when connecting the app. The local `.trial-account.txt` token belongs to a different database.

The account already has the six-week sample programme, starting 30 September 2026, with four daily sessions and a daily check-in. No completion or symptom history has been fabricated; there is no need to seed it again.

For an additional account, open a shell with `railway ssh --service rehab-api` and run:

```bash
node apps/api/dist/account.js "Your name"
```

Save the returned user ID and token. The command prints the token once, stores only its hash, and creates no sample medical data. For a replacement token on the same account, append the existing user UUID as the second argument.

From your local repository, seed that account through the public API:

```bash
export API_URL='https://your-api.up.railway.app'
read -rsp 'Personal token: ' API_TOKEN
export API_TOKEN
npm run seed
unset API_TOKEN
```

Skip seeding if you want to load your actual clinician-provided programme using the API instead. The seed has four sessions every day to make the first trial straightforward.

References: [Railway PostgreSQL](https://docs.railway.com/databases/postgresql), [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code), [Railway SSH](https://docs.railway.com/cli/ssh).

## 2. Install on your iPhone

The easiest independent trial is an EAS **preview build**, which runs without your development machine or Metro server.

1. Sign into Expo, choose your unique iOS bundle identifier in `apps/mobile/app.json`, and link an EAS project.
2. From `apps/mobile`:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   npx eas-cli@latest device:create
   npx eas-cli@latest build --platform ios --profile preview
   ```

3. Follow the signing prompts using your Apple Developer account. Register the iPhone when prompted and install from the build link on that phone.
4. Enable **Settings → Privacy & Security → Developer Mode** on the iPhone, restart when prompted, and confirm. See [Expo's Developer Mode instructions](https://docs.expo.dev/guides/ios-developer-mode/).
5. In the app, connect using the Railway HTTPS URL and the token created in the Railway API container. The existing local trial token belongs to your local database and will not authenticate against the new Railway database. Tokens are not embedded in the app bundle; iOS stores them using SecureStore.
6. Commit and push the Expo project configuration changes made by `eas init`.

The `development` profile supports Metro and debugging. The `production` profile is available for a later TestFlight/App Store build. No EAS project ID or Apple team has been invented in the configuration.

References: [EAS setup](https://docs.expo.dev/build/setup/), [internal iOS distribution](https://docs.expo.dev/build/internal-distribution/).

## Updating the trial

Run `railway up --service rehab-api --detach` from the root to deploy API changes. This service was deployed through the CLI; GitHub autodeploy has not been configured. Changes to `.railway/railway.ts` require a separate `railway config plan` and `railway config apply` before uploading; deployment does not automatically apply IaC.

Programme, exercise and assessment changes made through the API appear after the app syncs. To deliver app code changes, run `npx eas-cli@latest build --platform ios --profile preview` from `apps/mobile` again and install the new build. EAS Update is not configured in v1.

## 3. Physical-device acceptance pass

Run this before relying on the app for your daily programme:

- Open Today and confirm four sessions for the seeded programme.
- Enable reminders, allow iOS notifications and use “Try a reminder in 10 seconds”.
- Set an actual session reminder a few minutes ahead. Lock the phone. Tap the notification and confirm it opens the correct exercise list.
- Repeat after fully closing the app to exercise cold-start navigation.
- Check the notification’s complete, skip and snooze actions.
- Complete a session in airplane mode, close and reopen the app, and verify it remains recorded.
- Save a check-in offline. Reconnect, sync, and confirm both records in Progress and the API.
- Change a future prescription through the API. Verify today’s original plan stays unchanged and the future plan/reminders refresh when you sync.
- Review text size, scrolling, safe areas, keyboard behaviour and VoiceOver on your phone.

## Operations

`GET /health` checks database connectivity. API logs contain method, URL and status; request bodies and authorization headers are not logged. Personal tokens grant full access to one account. Issue separate mobile/agent tokens through `/tokens` and revoke them independently.

Use Railway’s database backups for the trial. The API container is stateless; do not attach a volume to it. No media is uploaded in v1; exercise media uses HTTPS URLs supplied by the programme author.

The initial migration is idempotent and guarded by a PostgreSQL advisory lock. Subsequent schema changes should introduce explicit versioned migrations before deployment.

## Local production-container smoke test

```bash
docker compose up -d
docker build -t rehab-api:trial .
docker run --rm --network rehab_default \
  -e DATABASE_URL=postgres://rehab:rehab@postgres:5432/rehab \
  rehab-api:trial node apps/api/dist/migrate.js
docker run --rm --network rehab_default -p 3001:3000 \
  -e DATABASE_URL=postgres://rehab:rehab@postgres:5432/rehab \
  rehab-api:trial
```

Visit `http://localhost:3001/health`. The Compose network name uses the checkout directory name; substitute it if your checkout is not named `rehab`.
