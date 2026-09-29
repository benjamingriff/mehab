# API guide

All paths below are relative to your API origin. Authenticate every data request with `Authorization: Bearer <personal-token>`. Use `/docs` for interactive Swagger documentation and `/openapi.json` for exact request and response contracts.

## Create a programme entirely through the API

First, `POST /exercises`:

```json
{
  "name": "Cervical rotation",
  "description": "Neck mobility",
  "instructions": ["Follow the technique and range your physiotherapist prescribed."],
  "category": "Mobility"
}
```

The response includes an `id`. Reference that ID in `POST /programmes`:

```json
{
  "name": "My rehabilitation",
  "startDate": "2026-10-05",
  "durationWeeks": 6,
  "timezone": "Europe/London",
  "phases": [
    { "name": "Settle & mobilise", "startWeek": 1, "endWeek": 2 },
    { "name": "Build strength", "startWeek": 3, "endWeek": 4 },
    { "name": "Progressive loading", "startWeek": 5, "endWeek": 6 }
  ],
  "sessions": [
    {
      "name": "Morning mobility",
      "time": "08:00",
      "weekdays": [1, 2, 3, 4, 5, 6, 7],
      "estimatedMinutes": 5,
      "prescriptions": [{ "exerciseId": "REPLACE_WITH_EXERCISE_UUID", "reps": 8, "side": "both" }]
    }
  ]
}
```

IDs are UUIDs. ISO weekdays are Monday `1` through Sunday `7`. A session with no `phaseId` runs throughout the programme; set `phaseId` to restrict it to that phase’s weeks. You can supply your own phase/template UUIDs to create cross-references in one request, or use the returned IDs in a future revision.

To start today instead, use today’s date in the programme’s timezone. `scripts/seed.ts` demonstrates the complete flow and chooses today automatically.

## Change a future schedule

`GET /programmes` returns the latest revision of each programme, including scheduled future revisions. `GET /programmes/:id` returns the full revision history.

To change a recurring evening reminder, retrieve the latest programme, change the relevant session’s `time`, and send:

```http
PATCH /programmes/PROGRAMME_UUID
```

```json
{
  "effectiveDate": "2026-10-06",
  "sessions": ["THE COMPLETE UPDATED SESSION ARRAY"]
}
```

The array above is schematic: send the actual session objects from the GET response, preserving template IDs. Arrays **replace**, rather than merge. The effective date must be tomorrow or later, and not earlier than the latest scheduled revision. Multiple changes for the same future date create distinct versions, with the latest version taking effect. Today’s sessions and history never change.

`POST /programmes/:id/sessions` accepts `{ "effectiveDate": "...", "session": { ... } }` to append a template. `POST /programmes/:id/phases` accepts `{ "effectiveDate": "...", "phase": { ... } }`. To change phases and their sessions together, use a single programme PATCH.

For one session occurrence only:

```http
PATCH /sessions/SESSION_UUID/reminder
```

```json
{ "reminderAt": "2026-10-05T17:00:00.000Z" }
```

`null` restores its scheduled time. Native notification schedules are refreshed when the app syncs.

## Sessions and completion

`GET /sessions?from=2026-10-05&to=2026-10-11` materialises and returns occurrences by local programme date. Each includes its own UUID, immutable prescription snapshot, UTC schedule, status and optional reminder override.

`POST /completions`:

```json
{
  "id": "CLIENT_GENERATED_EVENT_UUID",
  "sessionId": "SESSION_UUID",
  "status": "completed",
  "occurredAt": "2026-10-05T08:05:00.000Z",
  "exerciseIds": ["EXERCISE_UUID"]
}
```

Other statuses are `skipped` and `pending` (undo). Future days cannot be recorded early. Use a new UUID for a new action; retry the **same UUID and exact payload** for a failed connection. A repeated request does not create a duplicate event. A different payload under an existing UUID returns 409.

## Define and answer assessments

`POST /assessments`:

```json
{
  "name": "Daily check-in",
  "programmeId": "PROGRAMME_UUID",
  "trigger": "daily",
  "time": "09:00",
  "fields": [
    {
      "id": "pain",
      "label": "Pain",
      "type": "numericScale",
      "min": 0,
      "max": 10,
      "step": 1,
      "required": true
    },
    { "id": "symptoms", "label": "Arm symptoms?", "type": "boolean" },
    {
      "id": "severity",
      "label": "Severity",
      "type": "singleChoice",
      "options": ["Mild", "Moderate", "Severe"]
    },
    { "id": "areas", "label": "Areas", "type": "multiChoice", "options": ["Left", "Right"] },
    { "id": "notes", "label": "Notes", "type": "text" }
  ]
}
```

Triggers: `daily`, `weekly` (with ISO `weekday`), `afterSession`, `programmeStart`, `programmeEnd`. Numeric fields allow up to 100 equal steps. Field IDs must be unique within an assessment. PATCHing an assessment creates a new version.

`POST /assessment-responses`:

```json
{
  "id": "CLIENT_GENERATED_RESPONSE_UUID",
  "assessmentId": "ASSESSMENT_UUID",
  "assessmentVersion": 1,
  "date": "2026-10-05",
  "occurredAt": "2026-10-05T08:06:00.000Z",
  "answers": { "pain": 3, "symptoms": false, "areas": ["Left"], "notes": "A little easier today." }
}
```

An `afterSession` response must also include `sessionId`. Old assessment versions remain valid for offline submissions. Response dates must fall within the programme and cannot be in the future. Retrying the same UUID/payload is safe. The response embeds the definition that was answered.

## Progress and agent access

- `GET /progress?from=...&to=...`: due-session count, completed, skipped and adherence percentage.
- `GET /assessment-responses?from=...&to=...`: full response history and field definitions.
- `GET /sync?from=...&to=...`: complete client snapshot including programme revisions, sessions, assessments and responses.
- `POST /tokens` with `{ "name": "My external agent" }`: issue another token for the same account; secret returned once.
- `GET /tokens`: token metadata, never secrets.
- `DELETE /tokens/:id`: revoke a token immediately.

Date ranges are inclusive and limited to a 750-day difference. Request bodies are limited to 512 KiB. Errors use `{ "error": "Description", "statusCode": 400 }`. Treat 401 as an invalid/revoked credential; preserve unsynced local writes while resolving it. Tokens currently have full account access, with no per-resource scopes.
