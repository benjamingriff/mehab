import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import {
  addDays,
  dayInZone,
  scheduledAt,
  scheduled,
  validateAnswers,
  type Programme,
} from '@rehab/core';
import { buildApp } from '../src/app.js';
import { pool, migrate } from '../src/db.js';
process.env.NODE_ENV = 'test';
const app = await buildApp();
const users = [randomUUID(), randomUUID()];
const tokens = users.map(() => randomBytes(32).toString('hex'));
const today = dayInZone();
async function call(method: string, path: string, payload?: any, who = 0) {
  const r = await app.inject({
    method: method as any,
    url: path,
    headers: { authorization: `Bearer ${tokens[who]}` },
    payload,
  });
  return { status: r.statusCode, body: r.json() };
}
async function ok(method: string, path: string, payload?: any) {
  const r = await call(method, path, payload);
  assert.ok(r.status < 300, JSON.stringify(r));
  return r.body;
}
let exercise: any, p: any, a: any, sessions: any[];
before(async () => {
  await migrate();
  for (let i = 0; i < 2; i++) {
    await pool.query('INSERT INTO users(id,name) VALUES($1,$2)', [users[i], 'Integration test']);
    await pool.query('INSERT INTO tokens(id,user_id,hash,name) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      users[i],
      createHash('sha256').update(tokens[i]).digest('hex'),
      'Test',
    ]);
  }
});
after(async () => {
  for (const table of ['assessment_responses', 'completion_events', 'sessions'])
    await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::uuid[])`, [users]);
  await pool.query(
    'DELETE FROM assessment_versions WHERE assessment_id IN(SELECT id FROM assessments WHERE user_id=ANY($1::uuid[]))',
    [users],
  );
  await pool.query('DELETE FROM assessments WHERE user_id=ANY($1::uuid[])', [users]);
  await pool.query(
    'DELETE FROM programme_versions WHERE programme_id IN(SELECT id FROM programmes WHERE user_id=ANY($1::uuid[]))',
    [users],
  );
  for (const table of ['programmes', 'exercises', 'tokens'])
    await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::uuid[])`, [users]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
  await app.close();
  await pool.end();
});
test('authentication is required; health and OpenAPI are public', async () => {
  assert.equal((await app.inject('/programmes')).statusCode, 401);
  assert.equal((await app.inject('/health')).statusCode, 200);
  const spec = (await app.inject('/openapi.json')).json();
  assert.ok(spec.paths['/assessment-responses'].post.requestBody);
  assert.ok(spec.components.securitySchemes.bearerAuth);
});
test('API creates a complete programme and four scheduled sessions', async () => {
  exercise = await ok('POST', '/exercises', { name: 'Rotation', instructions: ['Turn gently.'] });
  p = await ok('POST', '/programmes', {
    name: 'Trial',
    startDate: today,
    durationWeeks: 6,
    phases: [{ name: 'First phase', startWeek: 1, endWeek: 2 }],
    sessions: ['08:00', '13:00', '17:30', '20:30'].map((time) => ({
      name: 'Mobility',
      time,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      estimatedMinutes: 5,
      prescriptions: [{ exerciseId: exercise.id, reps: 8, side: 'both' }],
    })),
  });
  sessions = await ok('GET', `/sessions?from=${today}&to=${today}`);
  assert.equal(sessions.length, 4);
  assert.equal(sessions[0].snapshot.prescriptions[0].exercise.name, 'Rotation');
  assert.equal(sessions[0].snapshot.prescriptions[0].reps, 8);
});
test('ownership cannot be bypassed in reads or nested writes', async () => {
  assert.equal((await call('GET', `/sessions/${sessions[0].id}`, undefined, 1)).status, 404);
  assert.equal(
    (
      await call(
        'PATCH',
        `/programmes/${p.id}`,
        { name: 'Stolen', effectiveDate: addDays(today, 1) },
        1,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        'POST',
        '/programmes',
        {
          name: 'Bad',
          startDate: today,
          durationWeeks: 1,
          sessions: [
            {
              name: 'Foreign',
              time: '08:00',
              weekdays: [1],
              estimatedMinutes: 1,
              prescriptions: [{ exerciseId: exercise.id }],
            },
          ],
        },
        1,
      )
    ).status,
    404,
  );
  assert.deepEqual((await call('GET', '/programmes', undefined, 1)).body, []);
});
test('invalid schedules, timezone, phases and numeric values are rejected', async () => {
  for (const extra of [
    { timezone: 'Mars/Olympus' },
    { startDate: '2026-02-30' },
    { phases: [{ name: 'Invalid', startWeek: 2, endWeek: 1 }] },
    { phases: [{ name: 'Outside', startWeek: 1, endWeek: 8 }] },
    {
      sessions: [
        { name: 'No', time: '28:00', weekdays: [0], estimatedMinutes: 1, prescriptions: [] },
      ],
    },
  ])
    assert.equal(
      (
        await call('POST', '/programmes', {
          name: 'Bad',
          startDate: today,
          durationWeeks: 6,
          ...extra,
        })
      ).status,
      400,
    );
});
test('completion retries are idempotent and conflicting payloads rejected', async () => {
  const event = {
    id: randomUUID(),
    sessionId: sessions[0].id,
    status: 'completed',
    occurredAt: new Date().toISOString(),
    exerciseIds: [exercise.id],
  };
  const results = await Promise.all([
    call('POST', '/completions', event),
    call('POST', '/completions', event),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  const count = await pool.query('SELECT count(*) FROM completion_events WHERE id=$1', [event.id]);
  assert.equal(Number(count.rows[0].count), 1);
  assert.equal((await call('POST', '/completions', { ...event, exerciseIds: [] })).status, 409);
  assert.equal((await ok('GET', `/sessions/${sessions[0].id}`)).status, 'completed');
});
test('skip and undo produce explicit events; unknown exercises are rejected', async () => {
  const e = {
    id: randomUUID(),
    sessionId: sessions[1].id,
    status: 'skipped',
    occurredAt: new Date().toISOString(),
  };
  assert.equal((await ok('POST', '/completions', e)).status, 'skipped');
  assert.equal(
    (await ok('POST', '/completions', { ...e, id: randomUUID(), status: 'pending' })).status,
    'pending',
  );
  assert.equal(
    (await call('POST', '/completions', { ...e, id: randomUUID(), exerciseIds: [randomUUID()] }))
      .status,
    400,
  );
});
test('future sessions cannot be completed early', async () => {
  const future = await ok('GET', `/sessions?from=${addDays(today, 1)}&to=${addDays(today, 1)}`);
  assert.equal(
    (
      await call('POST', '/completions', {
        id: randomUUID(),
        sessionId: future[0].id,
        status: 'completed',
        occurredAt: new Date().toISOString(),
      })
    ).status,
    400,
  );
});
test('future programme revisions replace future instances and preserve today and completed history', async () => {
  const future = addDays(today, 1);
  await ok('PATCH', `/exercises/${exercise.id}`, { name: 'Updated rotation' });
  const revised = await ok('PATCH', `/programmes/${p.id}`, {
    effectiveDate: future,
    sessions: p.sessions.map((s: any) => ({
      ...s,
      prescriptions: [{ exerciseId: exercise.id, reps: 12 }],
    })),
  });
  assert.equal(revised.version, 2);
  const past = await ok('GET', `/sessions/${sessions[0].id}`);
  assert.equal(past.snapshot.prescriptions[0].reps, 8);
  assert.equal(past.snapshot.prescriptions[0].exercise.name, 'Rotation');
  const upcoming = await ok('GET', `/sessions?from=${future}&to=${future}`);
  assert.equal(upcoming.length, 4);
  assert.equal(upcoming[0].snapshot.prescriptions[0].reps, 12);
  assert.equal(upcoming[0].snapshot.prescriptions[0].exercise.name, 'Updated rotation');
  assert.equal(
    (await call('PATCH', `/programmes/${p.id}`, { name: 'Rewrite today', effectiveDate: today }))
      .status,
    400,
  );
});
test('multiple edits to the same future effective date create distinct revisions', async () => {
  const revised = await ok('PATCH', `/programmes/${p.id}`, {
    effectiveDate: addDays(today, 1),
    name: 'Updated trial',
  });
  assert.equal(revised.version, 3);
  assert.equal(revised.sessions.length, 4);
  assert.equal(revised.phases.length, 1);
  assert.equal(revised.sessions[0].prescriptions[0].exercise.instructions[0], 'Turn gently.');
  assert.equal((await ok('GET', `/sessions/${sessions[0].id}`)).programmeVersion, 1);
  const future = await ok('GET', `/sessions?from=${addDays(today, 1)}&to=${addDays(today, 1)}`);
  assert.equal(future[0].programmeVersion, 3);
});
test('all five assessment field types validate, including required false and zero', async () => {
  a = await ok('POST', '/assessments', {
    name: 'Daily check-in',
    programmeId: p.id,
    time: '17:00',
    fields: [
      { id: 'pain', label: 'Pain', type: 'numericScale', required: true },
      { id: 'symptoms', label: 'Symptoms', type: 'boolean', required: true },
      { id: 'severity', label: 'Severity', type: 'singleChoice', options: ['Mild', 'Severe'] },
      { id: 'areas', label: 'Areas', type: 'multiChoice', options: ['Left', 'Right'] },
      { id: 'notes', label: 'Notes', type: 'text' },
    ],
  });
  const base = {
    id: randomUUID(),
    assessmentId: a.id,
    assessmentVersion: 1,
    date: today,
    occurredAt: new Date().toISOString(),
    answers: { pain: 0, symptoms: false, severity: 'Mild', areas: ['Left'], notes: 'A good day' },
  };
  assert.equal((await ok('POST', '/assessment-responses', base)).answers.pain, 0);
  assert.equal((await ok('POST', '/assessment-responses', base)).id, base.id);
  assert.equal(
    (
      await call('POST', '/assessment-responses', {
        ...base,
        answers: { pain: 1, symptoms: false },
      })
    ).status,
    409,
  );
  for (const answers of [
    { pain: 11, symptoms: false },
    { pain: 1.5, symptoms: false },
    { pain: 0 },
    { pain: 1, symptoms: 'no' },
    { pain: 0, symptoms: false, areas: ['Bad'] },
    { pain: 0, symptoms: false, unknown: 2 },
  ])
    assert.equal(
      (await call('POST', '/assessment-responses', { ...base, id: randomUUID(), answers })).status,
      400,
    );
});
test('assessment revisions preserve old response labels and allow offline submissions of old versions', async () => {
  await ok('PATCH', `/assessments/${a.id}`, {
    fields: [{ id: 'pain', label: 'New pain scale', type: 'numericScale', max: 5 }],
  });
  const response = await ok('POST', '/assessment-responses', {
    id: randomUUID(),
    assessmentId: a.id,
    assessmentVersion: 1,
    date: today,
    occurredAt: new Date().toISOString(),
    answers: { pain: 8, symptoms: false },
  });
  assert.equal(response.assessment.fields[0].label, 'Pain');
  assert.equal(response.assessment.version, 1);
  const latest = await ok('GET', '/assessments');
  assert.equal(latest.find((x: any) => x.id === a.id).time, '17:00');
  assert.equal(
    (
      await call('POST', '/assessment-responses', {
        id: randomUUID(),
        assessmentId: a.id,
        assessmentVersion: 2,
        date: addDays(today, 1),
        occurredAt: new Date().toISOString(),
        answers: { pain: 1 },
      })
    ).status,
    400,
  );
});
test('sync contains current history and does not cross account boundaries', async () => {
  const snapshot = await ok('GET', `/sync?from=${today}&to=${addDays(today, 2)}`);
  assert.equal(snapshot.programmes.length, 3);
  assert.equal(snapshot.sessions.length, 12);
  assert.equal(snapshot.user.id, users[0]);
  assert.equal(snapshot.responses.length, 2);
  const empty = await call('GET', `/sync?from=${today}&to=${today}`, undefined, 1);
  assert.equal(empty.body.sessions.length, 0);
  assert.equal(empty.body.responses.length, 0);
});
test('reminder overrides are stored per occurrence', async () => {
  const reminderAt = new Date(Date.now() + 900000).toISOString();
  assert.equal(
    (await ok('PATCH', `/sessions/${sessions[2].id}/reminder`, { reminderAt })).reminderAt,
    reminderAt,
  );
  assert.equal(
    (await ok('PATCH', `/sessions/${sessions[2].id}/reminder`, { reminderAt: null })).reminderAt,
    undefined,
  );
});
test('personal tokens can be issued, used, and revoked', async () => {
  const t = await ok('POST', '/tokens', { name: 'External agent' });
  assert.equal(
    (await app.inject({ url: '/me', headers: { authorization: `Bearer ${t.token}` } })).statusCode,
    200,
  );
  await ok('DELETE', `/tokens/${t.id}`);
  assert.equal(
    (await app.inject({ url: '/me', headers: { authorization: `Bearer ${t.token}` } })).statusCode,
    401,
  );
});
test('London local schedules remain at 08:00 across daylight saving transitions', () => {
  const sample = { ...p, startDate: '2026-10-01', effectiveDate: '2026-10-01' } as Programme;
  const t = sample.sessions[0];
  assert.equal(scheduledAt(sample, '2026-10-24', t), '2026-10-24T07:00:00.000Z');
  assert.equal(scheduledAt(sample, '2026-10-25', t), '2026-10-25T08:00:00.000Z');
  assert.equal(scheduled(sample, '2026-09-30', t), false);
  assert.equal(scheduled(sample, '2026-12-01', t), false);
});
