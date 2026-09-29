# Railway and iPhone deployment

The repository is prepared for deployment. Railway and Apple/Expo account setup, signing and installation are the remaining steps; nothing has been published automatically.

## 1. Railway API + PostgreSQL

1. Put this repository in your GitHub account and create a Railway project.
2. Add Railway PostgreSQL.
3. Add an API service from this repository. **Use the repository root**, not `apps/api`, as the build context. The root Dockerfile builds only the API and shared package.
4. Set these API service variables:

   | Variable       | Value                                                                                |
   | -------------- | ------------------------------------------------------------------------------------ |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (use your database service’s actual name)               |
   | `NODE_ENV`     | `production`                                                                         |
   | `CORS_ORIGINS` | Comma-separated browser origins, e.g. `http://localhost:8081` for your local preview |

   Railway supplies `PORT`. The API listens on `0.0.0.0`. Native iPhone requests do not need a CORS origin.

5. Deploy. `railway.json` runs the database migration before deployment and checks `/health` before routing traffic to the new instance.
6. Generate a public HTTPS domain for the API. Visit `/health`, `/docs` and `/openapi.json` on that domain.
7. Open a shell in the deployed API service using the Railway dashboard’s **Copy SSH Command**. In that shell, run:

   ```bash
   node apps/api/dist/account.js "Your name"
   ```

   Save the returned user ID and token. The command prints the token once, stores only its hash, and creates no sample medical data. For a replacement token on the same account, append the existing user UUID as the second argument.

8. From your local repository, seed that account through the public API:

   ```bash
   export API_URL='https://your-api.up.railway.app'
   read -rsp 'Personal token: ' API_TOKEN
   export API_TOKEN
   npm run seed
   unset API_TOKEN
   ```

   Skip seeding if you want to load your actual clinician-provided programme using the API instead. The seed has four sessions every day to make the first trial straightforward.

References: [Railway PostgreSQL](https://docs.railway.com/databases/postgresql), [Docker deployment](https://docs.railway.com/guides/express), [Railway SSH](https://docs.railway.com/cli/ssh).

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
4. In the app, connect using the Railway HTTPS URL and your personal token. Tokens are not embedded in the app bundle; iOS stores them using SecureStore.

The `development` profile supports Metro and debugging. The `production` profile is available for a later TestFlight/App Store build. No EAS project ID or Apple team has been invented in the configuration.

References: [EAS setup](https://docs.expo.dev/build/setup/), [internal iOS distribution](https://docs.expo.dev/build/internal-distribution/).

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
