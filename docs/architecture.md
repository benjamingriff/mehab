# Architecture

## Backend

Fastify runs as a stateless Node 24 service. PostgreSQL stores users, hashed personal tokens, reusable exercises, programme versions, session instances, completion events, assessment versions and responses. The API uses explicit SQL transactions through `pg`; no hosted auth service or ORM is required for this trial.

All data requests resolve the token to a user. Every resource lookup includes ownership, including nested exercise/programme/session references. Account mutations and snapshot generation acquire a per-user PostgreSQL transaction advisory lock. This prevents concurrent materialisation, revision and completion requests from creating inconsistent plans.

Programme and assessment content is stored as validated JSONB with relational ownership and version keys. This preserves exact historical definitions without requiring a migration for every optional prescription field. PostgreSQL is the source of truth; JSONB content is never trusted without input validation.

## Time and prescriptions

A programme has a start date, duration and IANA timezone. Session schedules use local `HH:MM` and ISO weekdays (Monday 1, Sunday 7). Luxon converts each occurrence to UTC; local 08:00 remains local 08:00 through daylight-saving transitions. A nonexistent DST time follows Luxon’s forward adjustment; avoid scheduling in the 01:00–03:00 transition window when exact timing matters.

The exercise library defines the movement. Programme revisions include the prescriptions and a copy of the exercise definition. Editing the library does not silently rewrite existing plans. Creating a new programme revision resolves exercise references again.

Each occurrence snapshots its template and prescriptions, with its own status and reminder override. Instances are materialised on read for the requested date range; no server cron is required. Historical instances are also reconstructable from the dated programme revisions if they have never been read before.

Revision `effectiveDate` must be tomorrow or later in the existing programme’s timezone, and not before the latest scheduled revision. A new revision regenerates unrecorded future occurrences, preserving today and all past occurrences. Programme start dates cannot be edited. Phases use inclusive programme weeks and cannot overlap. Template IDs remain stable when supplied in a revision.

Completing a session records all its prescribed exercise IDs. V1 does not record individual exercise execution or time spent. Skip and undo are explicit events. Completion events use client UUIDs as idempotency keys, and retrying an ID with different content returns 409.

## Assessments and progress

Each response references and embeds the exact assessment version answered. Old versions remain accepted for delayed offline submission. Required `false` and `0` answers are valid. Types, ranges, step intervals, choice membership and unknown field IDs are validated.

Today shows due daily, weekly and programme-start/end questionnaires. Post-session assessments are offered after completion. Scheduled check-ins can have local reminders. More than one response on a day is allowed; the chart uses the latest submitted observation on each date. Full response history remains visible. Different assessment IDs or numeric ranges are never merged into one trend.

Adherence is completed / due sessions. Skipped sessions stay in the denominator. Future pending sessions are excluded. Symptom charts have real date spacing, do not fill in missing observations and do not make clinical claims.

## Offline storage and sync

The phone stores a single JSON snapshot and ordered outbox in AsyncStorage, scoped to server URL and user ID. A serial write queue waits for storage success before showing a mutation as saved. Pending jobs are replayed over the server snapshot to provide the optimistic view. A response acknowledgement removes only that job, so a concurrent local action cannot be overwritten by a sync.

Sync drains jobs in order, then refreshes the server snapshot. A stable UUID accompanies each completion and questionnaire response. Per-occurrence reminder updates are naturally idempotent PUT-like patches. Requests have a 12-second timeout; a dropped response can be retried safely. TanStack Query refreshes while the app is open, and an AppState listener syncs when returning to the foreground.

A lost connection never discards the queue. Data remains cached across an app restart. Sync is foreground-only. There is no promise of indefinite offline operation: the cache spans the previous 730 days and next 14 days. The app shows an explicit message outside the cached calendar.

Tokens use iOS SecureStore. For the browser preview, the token uses sessionStorage (the tab’s lifetime). Account snapshots and outboxes use AsyncStorage; they are not encrypted with an application-specific key. On iOS they rely on the app sandbox and device protection. Disconnecting removes credentials, keeps account-scoped cache, and is blocked while writes remain unsynced.

## Conflicts

A 4xx rejection leaves the change on the device, highlights it in Settings, and pauses the queue. Retry after fixing the underlying issue, or explicitly remove the rejected change to return to the server record. There is no silent last-write conflict resolution for failed requests.

A future schedule edited elsewhere can invalidate a previously cached future occurrence. If a device remained offline, subsequently records that superseded occurrence and later reconnects, its write is retained as an error rather than attached to a prescription the user never saw. Review the old record, sync the revised plan and record the appropriate result. Multi-device concurrent accepted completion events use server arrival order; automatic merging is outside this single-user trial.

## Notifications

Expo schedules the nearest 60 pending session/check-in notifications using absolute dates. Each session notification carries its occurrence UUID and route. Open, complete, skip and 15-minute snooze actions are handled after the account cache is loaded, including the most recent cold-start response.

Every foreground sync replenishes the queue. Completing/skipping/snoozing a session updates the local notification set immediately, including offline. Notification scheduling errors are surfaced in Settings. The device handles scheduled notifications without a network connection. Server edits cannot update notifications on a disconnected phone until it syncs.

V1 intentionally does not introduce APNs/server push, background task guarantees, a guided exercise player, clinical decision-making or AI inference.
