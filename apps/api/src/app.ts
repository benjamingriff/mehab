import { exercisePatch, assessmentPatch } from '@rehab/core';
import {
  exerciseSchema,
  programmeSchema,
  sessionSchema,
  assessmentSchema,
  responseSchema,
  adherenceSchema,
  dashboardSchema,
} from '@rehab/core';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  validatorCompiler,
  serializerCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DateTime } from 'luxon';
import {
  programmeInput,
  programmePatch,
  exerciseInput,
  sessionInput,
  phaseInput,
  assessmentInput,
  completionInput,
  responseInput,
  id,
  date,
  validateAnswers,
  dayInZone,
  addDays,
  adherence,
  type Assessment,
  type Programme,
} from '@rehab/core';
import { pool } from './db.js';
import { fail, owned, versions, hydrate, revise, materialize, sessionRow } from './service.js';
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    tokenId: string;
  }
}
const params = z.object({ id });
export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: 512 * 1024,
    trustProxy: (address, hop) => hop === 0,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cors, {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8081').split(','),
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Rehab API',
        version: '1.0.0',
        description:
          'Programmes, prescriptions and recorded progress. Weekdays use ISO 1=Monday, 7=Sunday. Revisions take effect on a future local date. Use client-generated UUIDs for retry-safe completions and responses.',
      },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.addHook('onRoute', (route) => {
    const method = String(route.method);
    const schemas: Record<string, z.ZodType> = {
      'GET /exercises': z.array(exerciseSchema),
      'POST /exercises': exerciseSchema,
      'PATCH /exercises/:id': exerciseSchema,
      'GET /programmes': z.array(programmeSchema),
      'POST /programmes': programmeSchema,
      'GET /programmes/:id': z.array(programmeSchema),
      'PATCH /programmes/:id': programmeSchema,
      'POST /programmes/:id/sessions': programmeSchema,
      'POST /programmes/:id/phases': programmeSchema,
      'GET /sessions': z.array(sessionSchema),
      'GET /sessions/:id': sessionSchema,
      'PATCH /sessions/:id/reminder': sessionSchema,
      'POST /completions': sessionSchema,
      'GET /assessments': z.array(assessmentSchema),
      'POST /assessments': assessmentSchema,
      'PATCH /assessments/:id': assessmentSchema,
      'GET /assessment-responses': z.array(responseSchema),
      'POST /assessment-responses': responseSchema,
      'GET /progress': adherenceSchema,
      'GET /sync': dashboardSchema,
      'GET /me': z.object({ id, name: z.string() }),
      'POST /tokens': z.object({ id, token: z.string() }),
      'DELETE /tokens/:id': z.object({ revoked: z.boolean() }),
    };
    const schema = schemas[`${method} ${route.url}`];
    if (schema)
      route.schema = {
        ...route.schema,
        response: {
          200: schema,
          ...(method === 'POST' ? { 201: schema } : {}),
          400: z.object({ error: z.string(), statusCode: z.number() }),
          401: z.object({ error: z.string(), statusCode: z.number() }),
          404: z.object({ error: z.string(), statusCode: z.number() }),
          409: z.object({ error: z.string(), statusCode: z.number() }),
        },
      };
  });
  app.decorateRequest('userId', '');
  app.decorateRequest('tokenId', '');
  app.addHook('onRequest', async (req) => {
    if (
      req.url === '/health' ||
      req.url === '/openapi.json' ||
      req.url.startsWith('/docs') ||
      req.method === 'OPTIONS'
    )
      return;
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token || token.length > 200) fail(401, 'A personal API token is required');
    const r = await pool.query(
      'SELECT id,user_id FROM tokens WHERE hash=$1 AND revoked_at IS NULL',
      [createHash('sha256').update(token).digest('hex')],
    );
    if (!r.rows[0]) fail(401, 'Invalid or revoked API token');
    req.userId = r.rows[0].user_id;
    req.tokenId = r.rows[0].id;
  });
  app.setErrorHandler((err, req, reply) => {
    const e = err as any;
    const status = e.validation ? 400 : (e.statusCode ?? 500);
    if (status >= 500) req.log.error(err);
    reply.code(status).send({
      error: status >= 500 ? 'The request could not be completed' : e.message,
      statusCode: status,
    });
  });
  async function tx<T>(user: string, fn: (c: PoolClient) => Promise<T>) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user]);
      const result = await fn(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  app.get('/health', { schema: { security: [], summary: 'Readiness check' } }, async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  });
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  app.get(
    '/me',
    { schema: { summary: 'Authenticated account' } },
    async (req) =>
      (await pool.query('SELECT id,name FROM users WHERE id=$1', [req.userId])).rows[0],
  );
  app.get(
    '/tokens',
    { schema: { summary: 'List personal token metadata' } },
    async (req) =>
      (
        await pool.query('SELECT id,name,created_at,revoked_at FROM tokens WHERE user_id=$1', [
          req.userId,
        ])
      ).rows,
  );
  app.post(
    '/tokens',
    {
      schema: {
        summary: 'Issue a personal token; secret returned once',
        body: z.object({ name: z.string().min(1).max(100) }),
      },
    },
    async (req, reply) => {
      const token = `rehab_${randomBytes(32).toString('hex')}`;
      const tokenId = randomUUID();
      await pool.query('INSERT INTO tokens(id,user_id,hash,name) VALUES($1,$2,$3,$4)', [
        tokenId,
        req.userId,
        createHash('sha256').update(token).digest('hex'),
        req.body.name,
      ]);
      reply.code(201);
      return { id: tokenId, token };
    },
  );
  app.delete(
    '/tokens/:id',
    { schema: { summary: 'Revoke a personal token', params } },
    async (req) => {
      const r = await pool.query(
        'UPDATE tokens SET revoked_at=now() WHERE id=$1 AND user_id=$2 RETURNING id',
        [req.params.id, req.userId],
      );
      if (!r.rowCount) fail(404, 'Token not found');
      return { revoked: true };
    },
  );
  app.get('/exercises', { schema: { summary: 'List reusable exercises' } }, async (req) =>
    (await pool.query('SELECT id,data FROM exercises WHERE user_id=$1', [req.userId])).rows.map(
      (r) => ({ ...r.data, id: r.id }),
    ),
  );
  app.post(
    '/exercises',
    { schema: { summary: 'Create a reusable exercise', body: exerciseInput } },
    async (req, reply) => {
      const ex = { ...req.body, id: randomUUID() };
      await pool.query('INSERT INTO exercises VALUES($1,$2,$3)', [ex.id, req.userId, ex]);
      reply.code(201);
      return ex;
    },
  );
  app.patch(
    '/exercises/:id',
    {
      schema: {
        summary: 'Edit the library exercise; existing prescriptions retain their snapshot',
        params,
        body: exercisePatch,
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        const old = await owned(c, 'exercises', req.params.id, req.userId);
        const data = { ...old.data, ...req.body, id: old.id };
        await c.query('UPDATE exercises SET data=$1 WHERE id=$2', [data, old.id]);
        return data;
      }),
  );
  app.get(
    '/programmes',
    { schema: { summary: 'List latest programme definitions (including future revisions)' } },
    async (req) =>
      tx(req.userId, async (c) => {
        const all = await versions(c, req.userId);
        return [...new Map(all.map((p) => [p.id, p])).values()];
      }),
  );
  app.post(
    '/programmes',
    {
      schema: {
        summary: 'Create a programme, phases and recurring session templates',
        body: programmeInput,
      },
    },
    async (req, reply) =>
      tx(req.userId, async (c) => {
        const p = await hydrate(c, req.userId, {
          ...req.body,
          id: randomUUID(),
          version: 1,
          effectiveDate: req.body.startDate,
        });
        await c.query('INSERT INTO programmes(id,user_id) VALUES($1,$2)', [p.id, req.userId]);
        await c.query('INSERT INTO programme_versions VALUES($1,1,$2,$3)', [
          p.id,
          p.effectiveDate,
          p,
        ]);
        reply.code(201);
        return p;
      }),
  );
  app.get(
    '/programmes/:id',
    { schema: { summary: 'Get a programme and its immutable revision history', params } },
    async (req) =>
      tx(req.userId, async (c) => {
        await owned(c, 'programmes', req.params.id, req.userId);
        return (await versions(c, req.userId)).filter((p) => p.id === req.params.id);
      }),
  );
  app.patch(
    '/programmes/:id',
    {
      schema: {
        summary: 'Create a future programme revision; arrays replace existing arrays',
        params,
        body: programmePatch,
      },
    },
    async (req) => tx(req.userId, (c) => revise(c, req.userId, req.params.id, req.body)),
  );
  app.post(
    '/programmes/:id/sessions',
    {
      schema: {
        summary: 'Append a scheduled session in a new future revision',
        params,
        body: z.object({ effectiveDate: date, session: sessionInput }),
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        await owned(c, 'programmes', req.params.id, req.userId);
        const old = (await versions(c, req.userId)).filter((p) => p.id === req.params.id).at(-1)!;
        return revise(c, req.userId, old.id, {
          effectiveDate: req.body.effectiveDate,
          sessions: [...old.sessions, req.body.session],
        });
      }),
  );
  app.post(
    '/programmes/:id/phases',
    {
      schema: {
        summary: 'Append a phase in a new future revision',
        params,
        body: z.object({ effectiveDate: date, phase: phaseInput }),
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        await owned(c, 'programmes', req.params.id, req.userId);
        const old = (await versions(c, req.userId)).filter((p) => p.id === req.params.id).at(-1)!;
        return revise(c, req.userId, old.id, {
          effectiveDate: req.body.effectiveDate,
          phases: [...old.phases, req.body.phase],
        });
      }),
  );
  const range = z
    .object({ from: date, to: date })
    .refine(
      (v) =>
        v.to >= v.from && DateTime.fromISO(v.to).diff(DateTime.fromISO(v.from), 'days').days <= 750,
      'Date range must be 0–750 days',
    );
  async function readSessions(c: PoolClient, user: string, from: string, to: string) {
    return (
      await c.query(
        'SELECT * FROM sessions WHERE user_id=$1 AND day BETWEEN $2 AND $3 ORDER BY scheduled_at',
        [user, from, to],
      )
    ).rows.map(sessionRow);
  }
  app.get(
    '/sessions',
    {
      schema: {
        summary: 'Materialize and list scheduled session instances by local date',
        querystring: range,
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        await materialize(c, req.userId, req.query.from, req.query.to);
        return readSessions(c, req.userId, req.query.from, req.query.to);
      }),
  );
  app.get(
    '/sessions/:id',
    { schema: { summary: 'Get a historical session snapshot', params } },
    async (req) =>
      tx(req.userId, async (c) =>
        sessionRow(await owned(c, 'sessions', req.params.id, req.userId)),
      ),
  );
  app.patch(
    '/sessions/:id/reminder',
    {
      schema: {
        summary: 'Change the reminder for one occurrence',
        params,
        body: z.object({ reminderAt: z.iso.datetime().nullable() }),
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        await owned(c, 'sessions', req.params.id, req.userId);
        const r = await c.query('UPDATE sessions SET reminder_at=$1 WHERE id=$2 RETURNING *', [
          req.body.reminderAt,
          req.params.id,
        ]);
        return sessionRow(r.rows[0]);
      }),
  );
  app.post(
    '/completions',
    {
      schema: {
        summary: 'Record or undo a session result; id is the idempotency key',
        body: completionInput,
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        const b = req.body;
        const prior = await c.query(
          'SELECT data FROM completion_events WHERE id=$1 AND user_id=$2',
          [b.id, req.userId],
        );
        if (prior.rowCount) {
          if (!isDeepStrictEqual(prior.rows[0].data, b))
            fail(409, 'Idempotency key already used with a different payload');
          return sessionRow(await owned(c, 'sessions', b.sessionId, req.userId));
        }
        const row = await owned(c, 'sessions', b.sessionId, req.userId);
        const p = (
          await c.query(
            'SELECT data FROM programme_versions WHERE programme_id=$1 AND version=$2',
            [row.programme_id, row.programme_version],
          )
        ).rows[0].data as Programme;
        if (sessionRow(row).date > dayInZone(p.timezone))
          fail(400, 'Future sessions cannot be recorded yet');
        if (DateTime.fromISO(b.occurredAt).toMillis() > Date.now() + 300000)
          fail(400, 'Completion time is in the future');
        if (
          b.exerciseIds.some(
            (x) => !row.snapshot.prescriptions.some((pr: any) => pr.exerciseId === x),
          )
        )
          fail(400, 'Exercise does not belong to session');
        await c.query('INSERT INTO completion_events VALUES($1,$2,$3,$4)', [
          b.id,
          req.userId,
          b.sessionId,
          b,
        ]);
        const r = await c.query(
          'UPDATE sessions SET status=$1,exercise_ids=$2,completed_at=$3 WHERE id=$4 RETURNING *',
          [
            b.status,
            JSON.stringify(b.exerciseIds),
            b.status === 'pending' ? null : b.occurredAt,
            b.sessionId,
          ],
        );
        return sessionRow(r.rows[0]);
      }),
  );
  app.get(
    '/assessments',
    { schema: { summary: 'List current assessment definitions' } },
    async (req) =>
      (
        await pool.query(
          'SELECT DISTINCT ON(a.id) v.data FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id WHERE a.user_id=$1 ORDER BY a.id,v.version DESC',
          [req.userId],
        )
      ).rows.map((r) => r.data),
  );
  app.post(
    '/assessments',
    { schema: { summary: 'Create a generic scheduled assessment', body: assessmentInput } },
    async (req, reply) =>
      tx(req.userId, async (c) => {
        await owned(c, 'programmes', req.body.programmeId, req.userId);
        const a = { ...req.body, id: randomUUID(), version: 1 };
        await c.query('INSERT INTO assessments VALUES($1,$2,$3)', [
          a.id,
          req.userId,
          a.programmeId,
        ]);
        await c.query('INSERT INTO assessment_versions VALUES($1,1,$2)', [a.id, a]);
        reply.code(201);
        return a;
      }),
  );
  app.patch(
    '/assessments/:id',
    {
      schema: {
        summary: 'Version an assessment; existing responses remain interpretable',
        params,
        body: assessmentPatch,
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        await owned(c, 'assessments', req.params.id, req.userId);
        const old = (
          await c.query(
            'SELECT data FROM assessment_versions WHERE assessment_id=$1 ORDER BY version DESC LIMIT 1',
            [req.params.id],
          )
        ).rows[0].data;
        const a = { ...old, ...req.body, version: old.version + 1 };
        await c.query('INSERT INTO assessment_versions VALUES($1,$2,$3)', [a.id, a.version, a]);
        return a;
      }),
  );
  app.post(
    '/assessment-responses',
    {
      schema: {
        summary: 'Save answers against an immutable assessment version; retry-safe by id',
        body: responseInput,
      },
    },
    async (req, reply) =>
      tx(req.userId, async (c) => {
        const b = req.body;
        const prior = await c.query(
          'SELECT data FROM assessment_responses WHERE id=$1 AND user_id=$2',
          [b.id, req.userId],
        );
        if (prior.rowCount) {
          const { assessment, ...original } = prior.rows[0].data;
          if (!isDeepStrictEqual(original, b))
            fail(409, 'Idempotency key already used with a different payload');
          return prior.rows[0].data;
        }
        await owned(c, 'assessments', b.assessmentId, req.userId);
        const r = await c.query(
          'SELECT data FROM assessment_versions WHERE assessment_id=$1 AND version=$2',
          [b.assessmentId, b.assessmentVersion],
        );
        if (!r.rowCount) fail(404, 'Assessment version not found');
        const a = r.rows[0].data as Assessment;
        const error = validateAnswers(a, b.answers);
        if (error) fail(400, error);
        if (a.trigger === 'afterSession' && !b.sessionId)
          fail(400, 'Session is required for this assessment');
        if (b.sessionId) {
          const s = await owned(c, 'sessions', b.sessionId, req.userId);
          if (s.programme_id !== a.programmeId)
            fail(400, 'Session belongs to a different programme');
        }
        const ps = (await versions(c, req.userId)).filter((p) => p.id === a.programmeId);
        const p = ps.filter((p) => p.effectiveDate <= b.date).at(-1) ?? ps[0];
        if (
          b.date > dayInZone(p.timezone) ||
          b.date < p.startDate ||
          b.date >= addDays(p.startDate, p.durationWeeks * 7)
        )
          fail(400, 'Response date is outside the programme or in the future');
        if (DateTime.fromISO(b.occurredAt).toMillis() > Date.now() + 300000)
          fail(400, 'Response time is in the future');
        const data = { ...b, assessment: a };
        await c.query(
          'INSERT INTO assessment_responses(id,user_id,assessment_id,day,data) VALUES($1,$2,$3,$4,$5)',
          [b.id, req.userId, a.id, b.date, data],
        );
        reply.code(201);
        return data;
      }),
  );
  app.get(
    '/assessment-responses',
    { schema: { summary: 'List response history', querystring: range } },
    async (req) =>
      (
        await pool.query(
          'SELECT data FROM assessment_responses WHERE user_id=$1 AND day BETWEEN $2 AND $3 ORDER BY day,created_at',
          [req.userId, req.query.from, req.query.to],
        )
      ).rows.map((r) => r.data),
  );
  app.get(
    '/progress',
    {
      schema: {
        summary:
          'Adherence for due sessions in a date range; skipped sessions remain in denominator',
        querystring: range,
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        await materialize(c, req.userId, req.query.from, req.query.to);
        const sessions = await readSessions(c, req.userId, req.query.from, req.query.to);
        return adherence(
          sessions.filter(
            (s) => s.status !== 'pending' || new Date(s.scheduledAt).getTime() <= Date.now(),
          ),
        );
      }),
  );
  app.get(
    '/sync',
    {
      schema: {
        summary: 'Offline snapshot: programme history, sessions and assessments',
        querystring: range,
      },
    },
    async (req) =>
      tx(req.userId, async (c) => {
        const programmes = await materialize(c, req.userId, req.query.from, req.query.to);
        return {
          user: (await c.query('SELECT id,name FROM users WHERE id=$1', [req.userId])).rows[0],
          programmes,
          sessions: await readSessions(c, req.userId, req.query.from, req.query.to),
          assessments: (
            await c.query(
              'SELECT DISTINCT ON(a.id) v.data FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id WHERE a.user_id=$1 ORDER BY a.id,v.version DESC',
              [req.userId],
            )
          ).rows.map((r) => r.data),
          responses: (
            await c.query(
              'SELECT data FROM assessment_responses WHERE user_id=$1 AND day BETWEEN $2 AND $3 ORDER BY day,created_at',
              [req.userId, req.query.from, req.query.to],
            )
          ).rows.map((r) => r.data),
          serverTime: new Date().toISOString(),
          ...req.query,
        };
      }),
  );
  return app;
}
