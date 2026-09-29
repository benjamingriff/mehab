import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DateTime } from 'luxon';
import {
  addDays,
  dayInZone,
  scheduled,
  scheduledAt,
  type Programme,
  type Session,
  type Exercise,
} from '@rehab/core';
export function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
export async function owned(
  c: PoolClient,
  table: 'programmes' | 'exercises' | 'assessments' | 'sessions',
  id: string,
  user: string,
) {
  const r = await c.query(`SELECT * FROM ${table} WHERE id=$1 AND user_id=$2`, [id, user]);
  return r.rows[0] ?? fail(404, 'Resource not found');
}
export async function versions(c: PoolClient, user: string) {
  const r = await c.query(
    'SELECT v.data FROM programme_versions v JOIN programmes p ON p.id=v.programme_id WHERE p.user_id=$1 ORDER BY v.version',
    [user],
  );
  return r.rows.map((x) => x.data as Programme);
}
export function atDate(all: Programme[], d: string) {
  const map = new Map<string, Programme>();
  for (const p of all) if (p.effectiveDate <= d) map.set(p.id, p);
  return [...map.values()];
}
export async function hydrate(c: PoolClient, user: string, raw: any): Promise<Programme> {
  const p = {
    ...raw,
    phases: raw.phases.map((x: any) => ({ ...x, id: x.id ?? randomUUID() })),
    sessions: [],
  };
  if (new Set(p.phases.map((x: any) => x.id)).size !== p.phases.length)
    fail(400, 'Duplicate phase IDs');
  for (const phase of p.phases)
    if (phase.endWeek > p.durationWeeks) fail(400, 'Phase exceeds programme duration');
  const sorted = [...p.phases].sort((a: any, b: any) => a.startWeek - b.startWeek);
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i].startWeek <= sorted[i - 1].endWeek) fail(400, 'Phases overlap');
  for (const t of raw.sessions) {
    if (t.phaseId && !p.phases.some((x: any) => x.id === t.phaseId)) fail(400, 'Unknown phase');
    const prescriptions = [];
    for (const pr of t.prescriptions) {
      const ex = await owned(c, 'exercises', pr.exerciseId, user);
      prescriptions.push({ ...pr, exercise: { ...ex.data, id: ex.id } as Exercise });
    }
    p.sessions.push({ ...t, id: t.id ?? randomUUID(), prescriptions });
  }
  if (new Set(p.sessions.map((x: any) => x.id)).size !== p.sessions.length)
    fail(400, 'Duplicate session template IDs');
  return p;
}
export async function revise(c: PoolClient, user: string, programmeId: string, patch: any) {
  await owned(c, 'programmes', programmeId, user);
  const r = await c.query(
    'SELECT data FROM programme_versions WHERE programme_id=$1 ORDER BY version DESC LIMIT 1',
    [programmeId],
  );
  const old = r.rows[0].data as Programme;
  if (patch.effectiveDate <= dayInZone(old.timezone))
    fail(400, 'Revisions must start tomorrow or later to preserve today and history');
  if (patch.effectiveDate < old.effectiveDate)
    fail(409, 'Revision must not start before the latest scheduled revision');
  const p = await hydrate(c, user, { ...old, ...patch, id: old.id, version: old.version + 1 });
  const recorded = await c.query(
    "SELECT 1 FROM sessions WHERE programme_id=$1 AND day >= $2 AND status <> 'pending' LIMIT 1",
    [p.id, p.effectiveDate],
  );
  if (recorded.rowCount) fail(409, 'Cannot replace recorded sessions');
  await c.query('INSERT INTO programme_versions VALUES($1,$2,$3,$4)', [
    p.id,
    p.version,
    p.effectiveDate,
    p,
  ]);
  await c.query("DELETE FROM sessions WHERE programme_id=$1 AND day >= $2 AND status='pending'", [
    p.id,
    p.effectiveDate,
  ]);
  return p;
}
export async function materialize(c: PoolClient, user: string, from: string, to: string) {
  const all = await versions(c, user);
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const p of atDate(all, d)) {
      for (const t of p.sessions) {
        if (scheduled(p, d, t))
          await c.query(
            'INSERT INTO sessions(id,user_id,programme_id,programme_version,template_id,day,scheduled_at,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(programme_id,template_id,day) DO NOTHING',
            [randomUUID(), user, p.id, p.version, t.id, d, scheduledAt(p, d, t), t],
          );
      }
    }
  }
  return all;
}
export function sessionRow(r: any): Session {
  return {
    id: r.id,
    programmeId: r.programme_id,
    programmeVersion: r.programme_version,
    templateId: r.template_id,
    date: DateTime.fromJSDate(r.day).toISODate()!,
    scheduledAt: r.scheduled_at.toISOString(),
    snapshot: r.snapshot,
    status: r.status,
    exerciseIds: r.exercise_ids,
    completedAt: r.completed_at?.toISOString(),
    reminderAt: r.reminder_at?.toISOString(),
  };
}
