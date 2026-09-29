import { z } from 'zod';
import { DateTime } from 'luxon';
export const id = z.string().uuid();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => DateTime.fromISO(v).isValid, 'Invalid date');
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const timezone = z
  .string()
  .refine((v) => DateTime.now().setZone(v).isValid, 'Use an IANA timezone');
const name = z.string().trim().min(1).max(120);
const prose = z.string().max(5000);
export const exerciseInput = z.object({
  name,
  description: prose.default(''),
  instructions: z.array(z.string().min(1).max(1000)).max(30).default([]),
  imageUrl: z
    .url()
    .regex(/^https:\/\//)
    .optional(),
  videoUrl: z
    .url()
    .regex(/^https:\/\//)
    .optional(),
  category: z.string().max(80).optional(),
  equipment: z.string().max(200).optional(),
});
export const prescriptionInput = z.object({
  exerciseId: id,
  sets: z.number().int().min(1).max(100).optional(),
  reps: z.number().int().min(1).max(1000).optional(),
  holdSeconds: z.number().int().min(1).max(3600).optional(),
  durationSeconds: z.number().int().min(1).max(14400).optional(),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  load: z.string().max(120).optional(),
  side: z.enum(['left', 'right', 'both']).optional(),
  notes: prose.optional(),
});
export const phaseInput = z
  .object({
    id: id.optional(),
    name,
    startWeek: z.number().int().min(1).max(104),
    endWeek: z.number().int().min(1).max(104),
  })
  .refine((v) => v.endWeek >= v.startWeek, 'End week must follow start week');
export const sessionInput = z.object({
  id: id.optional(),
  name,
  phaseId: id.optional(),
  time,
  weekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .refine((a) => new Set(a).size === a.length, 'Duplicate weekday'),
  estimatedMinutes: z.number().int().min(1).max(240),
  prescriptions: z.array(prescriptionInput).min(1).max(50),
});
export const programmeInput = z.object({
  name,
  description: prose.default(''),
  startDate: date,
  durationWeeks: z.number().int().min(1).max(104),
  timezone: timezone.default('Europe/London'),
  phases: z.array(phaseInput).max(50).default([]),
  sessions: z.array(sessionInput).max(50).default([]),
});
export const programmePatch = programmeInput.partial().omit({ startDate: true }).extend({
  effectiveDate: date,
  description: programmeInput.shape.description.removeDefault().optional(),
  timezone: programmeInput.shape.timezone.removeDefault().optional(),
  phases: programmeInput.shape.phases.removeDefault().optional(),
  sessions: programmeInput.shape.sessions.removeDefault().optional(),
});
const baseField = {
  id: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),
  label: name,
  required: z.boolean().default(false),
};
export const fieldInput = z.discriminatedUnion('type', [
  z
    .object({
      ...baseField,
      type: z.literal('numericScale'),
      min: z.number().default(0),
      max: z.number().default(10),
      step: z.number().positive().default(1),
    })
    .refine(
      (v) =>
        v.max > v.min &&
        (v.max - v.min) / v.step <= 100 &&
        Math.abs((v.max - v.min) / v.step - Math.round((v.max - v.min) / v.step)) < 1e-8,
      'Scale must have 1–100 equal steps',
    ),
  z.object({ ...baseField, type: z.literal('boolean') }),
  z.object({
    ...baseField,
    type: z.literal('singleChoice'),
    options: z.array(name).min(2).max(20),
  }),
  z.object({ ...baseField, type: z.literal('multiChoice'), options: z.array(name).min(2).max(20) }),
  z.object({ ...baseField, type: z.literal('text') }),
]);
export const assessmentInput = z.object({
  name,
  programmeId: id,
  trigger: z
    .enum(['daily', 'afterSession', 'weekly', 'programmeStart', 'programmeEnd'])
    .default('daily'),
  time: time.default('09:00'),
  weekday: z.number().int().min(1).max(7).default(1),
  fields: z
    .array(fieldInput)
    .min(1)
    .max(30)
    .refine((a) => new Set(a.map((f) => f.id)).size === a.length, 'Field IDs must be unique'),
});
export const completionInput = z.object({
  id: id,
  sessionId: id,
  status: z.enum(['completed', 'skipped', 'pending']),
  occurredAt: z.iso.datetime(),
  exerciseIds: z.array(id).max(50).default([]),
  notes: z.string().max(2000).optional(),
});
export const responseInput = z.object({
  id,
  assessmentId: id,
  assessmentVersion: z.number().int().positive(),
  date,
  sessionId: id.optional(),
  occurredAt: z.iso.datetime(),
  answers: z.record(
    z.string(),
    z.union([z.number(), z.boolean(), z.string().max(5000), z.array(z.string()).max(30)]),
  ),
});
export type Exercise = z.infer<typeof exerciseInput> & { id: string };
export type Prescription = z.infer<typeof prescriptionInput> & { exercise: Exercise };
export type Phase = z.infer<typeof phaseInput> & { id: string };
export type SessionTemplate = Omit<z.infer<typeof sessionInput>, 'prescriptions'> & {
  id: string;
  prescriptions: Prescription[];
};
export type Programme = Omit<z.infer<typeof programmeInput>, 'phases' | 'sessions'> & {
  id: string;
  version: number;
  effectiveDate: string;
  phases: Phase[];
  sessions: SessionTemplate[];
};
export type Session = {
  id: string;
  programmeId: string;
  programmeVersion: number;
  templateId: string;
  date: string;
  scheduledAt: string;
  snapshot: SessionTemplate;
  status: 'pending' | 'completed' | 'skipped';
  exerciseIds: string[];
  completedAt?: string;
  reminderAt?: string;
};
export type Assessment = z.infer<typeof assessmentInput> & { id: string; version: number };
export type AssessmentResponse = z.infer<typeof responseInput> & { assessment: Assessment };
export type Completion = z.infer<typeof completionInput>;
export type Dashboard = {
  user: { id: string; name: string };
  programmes: Programme[];
  sessions: Session[];
  assessments: Assessment[];
  responses: AssessmentResponse[];
  serverTime: string;
  from: string;
  to: string;
};
export const dayInZone = (zone = 'Europe/London') => DateTime.now().setZone(zone).toISODate()!;
export const addDays = (d: string, n: number) =>
  DateTime.fromISO(d, { zone: 'UTC' }).plus({ days: n }).toISODate()!;
export const programmeDay = (p: Programme, d: string) =>
  Math.floor(DateTime.fromISO(d).diff(DateTime.fromISO(p.startDate), 'days').days) + 1;
export function scheduled(p: Programme, d: string, t: SessionTemplate) {
  const day = programmeDay(p, d);
  const phase = p.phases.find((x) => x.id === t.phaseId);
  const week = Math.ceil(day / 7);
  return (
    day >= 1 &&
    day <= p.durationWeeks * 7 &&
    t.weekdays.includes(DateTime.fromISO(d).weekday) &&
    (!phase || (week >= phase.startWeek && week <= phase.endWeek))
  );
}
export function scheduledAt(p: Programme, d: string, t: SessionTemplate) {
  return DateTime.fromISO(`${d}T${t.time}`, { zone: p.timezone }).toUTC().toISO()!;
}
export function prescriptionLabel(p: z.infer<typeof prescriptionInput>) {
  const quantity = p.holdSeconds
    ? `${p.holdSeconds} sec hold`
    : p.reps
      ? `${p.reps} reps`
      : p.durationSeconds
        ? `${p.durationSeconds} sec`
        : 'At your own pace';
  return `${p.sets ? `${p.sets} × ` : ''}${quantity}${p.side === 'both' ? ' · each side' : p.side ? ` · ${p.side}` : ''}${p.load ? ` · ${p.load}` : ''}`;
}
export function validateAnswers(a: Assessment, answers: z.infer<typeof responseInput>['answers']) {
  for (const key of Object.keys(answers))
    if (!a.fields.some((f) => f.id === key)) return `Unknown field: ${key}`;
  for (const f of a.fields) {
    const v = answers[f.id];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
      if (f.required) return `${f.label} is required`;
      continue;
    }
    if (
      f.type === 'numericScale' &&
      (typeof v !== 'number' ||
        v < f.min ||
        v > f.max ||
        Math.abs((v - f.min) / f.step - Math.round((v - f.min) / f.step)) > 1e-8)
    )
      return `${f.label} is outside its scale`;
    if (f.type === 'boolean' && typeof v !== 'boolean') return `${f.label} must be yes or no`;
    if (f.type === 'singleChoice' && (typeof v !== 'string' || !f.options.includes(v)))
      return `${f.label} has an invalid option`;
    if (
      f.type === 'multiChoice' &&
      (!Array.isArray(v) || v.some((x) => !f.options.includes(x)) || new Set(v).size !== v.length)
    )
      return `${f.label} has invalid options`;
    if (f.type === 'text' && typeof v !== 'string') return `${f.label} must be text`;
  }
  return undefined;
}
export function assessmentDue(a: Assessment, p: Programme, d: string) {
  const day = programmeDay(p, d);
  if (day < 1 || day > p.durationWeeks * 7) return false;
  return (
    a.trigger === 'daily' ||
    (a.trigger === 'weekly' && DateTime.fromISO(d).weekday === a.weekday) ||
    (a.trigger === 'programmeStart' && day === 1) ||
    (a.trigger === 'programmeEnd' && day === p.durationWeeks * 7)
  );
}
export function adherence(sessions: Session[]) {
  const completed = sessions.filter((s) => s.status === 'completed').length;
  return {
    total: sessions.length,
    completed,
    skipped: sessions.filter((s) => s.status === 'skipped').length,
    percent: sessions.length ? Math.round((completed / sessions.length) * 100) : 0,
  };
}

// Response contracts also drive the OpenAPI schema and server serialization.
export const exerciseSchema = exerciseInput.extend({ id });
export const prescriptionSchema = prescriptionInput.extend({ exercise: exerciseSchema });
export const phaseSchema = phaseInput.safeExtend({ id });
export const templateSchema = sessionInput.extend({
  id,
  prescriptions: z.array(prescriptionSchema),
});
export const programmeSchema = programmeInput.extend({
  id,
  version: z.number().int(),
  effectiveDate: date,
  phases: z.array(phaseSchema),
  sessions: z.array(templateSchema),
});
export const sessionSchema = z.object({
  id,
  programmeId: id,
  programmeVersion: z.number().int(),
  templateId: id,
  date,
  scheduledAt: z.iso.datetime(),
  snapshot: templateSchema,
  status: z.enum(['pending', 'completed', 'skipped']),
  exerciseIds: z.array(id),
  completedAt: z.iso.datetime().optional(),
  reminderAt: z.iso.datetime().optional(),
});
export const assessmentSchema = assessmentInput.extend({ id, version: z.number().int() });
export const responseSchema = responseInput.extend({ assessment: assessmentSchema });
export const adherenceSchema = z.object({
  total: z.number().int(),
  completed: z.number().int(),
  skipped: z.number().int(),
  percent: z.number(),
});
export const dashboardSchema = z.object({
  user: z.object({ id, name: z.string() }),
  programmes: z.array(programmeSchema),
  sessions: z.array(sessionSchema),
  assessments: z.array(assessmentSchema),
  responses: z.array(responseSchema),
  serverTime: z.iso.datetime(),
  from: date,
  to: date,
});

// Defaults apply on creation, never to omitted fields in a PATCH.
export const exercisePatch = exerciseInput.partial().extend({
  description: exerciseInput.shape.description.removeDefault().optional(),
  instructions: exerciseInput.shape.instructions.removeDefault().optional(),
});
export const assessmentPatch = assessmentInput.omit({ programmeId: true }).partial().extend({
  trigger: assessmentInput.shape.trigger.removeDefault().optional(),
  time: assessmentInput.shape.time.removeDefault().optional(),
  weekday: assessmentInput.shape.weekday.removeDefault().optional(),
});
