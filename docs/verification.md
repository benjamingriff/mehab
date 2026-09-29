# Trial verification

Verified locally on 29 September 2026 with Node 24, PostgreSQL 17 in Docker, Chromium, and Expo SDK 57.

| Check                                                                 | Result                      |
| --------------------------------------------------------------------- | --------------------------- |
| TypeScript: API, shared models, mobile, scripts, browser tests        | Passed                      |
| Formatting                                                            | Passed                      |
| PostgreSQL API integration tests                                      | 15 passed                   |
| Browser end-to-end trial at 390 × 844                                 | Passed                      |
| Expo Doctor                                                           | 21/21 passed                |
| Expo production exports                                               | iOS, Android and web passed |
| Production Docker build                                               | Passed                      |
| Container migration + `/health`, authenticated `/me`, `/openapi.json` | Passed                      |
| npm dependency audit                                                  | 0 known vulnerabilities     |

API coverage includes authentication, account isolation, nested resource ownership, schedule validation, idempotent completion retries, conflicting retry payloads, skip/undo, future completion rejection, immutable session snapshots, repeat revisions on the same effective date, non-destructive partial updates, all five assessment field types, versioned offline assessment submission, snapshot isolation, reminder overrides, token revocation and London DST.

The browser test creates its own account through a trusted test fixture and seeds the programme through the HTTP API. It connects through the app UI, reads the entire session, expands instructions, records completion with the API unreachable, reloads, records a check-in offline, reloads again, reconnects and checks server-backed progress. It also revokes the mobile token, queues another result, replaces the token in Settings and verifies successful recovery. The test checks uncaught JavaScript and non-network console errors and removes its own database records afterward.

Visual inspection found and fixed a clipped tab label, an SVG rotation warning and a stray text node. Final screenshots are saved under `artifacts/` when the browser test runs.

The local sample account has no fabricated history. Its initial bootstrap token is in the ignored, owner-readable `.trial-account.txt`; this file is never copied into the production Docker image.

**Not yet verified:** a signed native iOS build on an actual phone, OS notification delivery/actions, cold-start notification routing, VoiceOver and native keyboard/safe-area behaviour. These are the first checks after the EAS preview build is installed. No Railway or Expo deployment has been performed.
