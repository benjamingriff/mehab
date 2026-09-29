import { DateTime } from 'luxon';
import { dayInZone, type Dashboard, type Prescription, type Programme } from '@rehab/core';
import { TONES, type Tone } from './ui';
export function currentProgrammes(data: Dashboard | null, date?: string) {
  const map = new Map<string, Programme>();
  for (const p of data?.programmes ?? []) {
    const d = date ?? dayInZone(p.timezone);
    if (p.effectiveDate <= d || !map.has(p.id)) map.set(p.id, p);
  }
  return [...map.values()];
}
export const formatTime = (time: string) => DateTime.fromFormat(time, 'HH:mm').toFormat('h:mm a');
export const shortTime = (time: string) => DateTime.fromFormat(time, 'HH:mm').toFormat('HH:mm');
export const dateLabel = (date: string) => DateTime.fromISO(date).toFormat('cccc, d LLLL');
export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function toneOf(category?: string): Tone {
  const c = (category ?? '').toLowerCase();
  if (/mobil|stretch|flex|range/.test(c)) return 'mobility';
  if (/strength|isometric|resist|load/.test(c)) return 'strength';
  if (/balance|proprio|stabil|control/.test(c)) return 'balance';
  if (/cardio|aerobic|endurance|conditioning/.test(c)) return 'cardio';
  return 'other';
}

/** The dominant exercise category of a session, for its colour and tag. */
export function sessionKind(prescriptions: Prescription[]) {
  const counts = new Map<string, number>();
  for (const p of prescriptions) {
    const c = p.exercise.category?.trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const tone = toneOf(top);
  return { label: top ?? 'Session', tone, color: TONES[tone] };
}

export function structure(prescriptions: Prescription[]) {
  return prescriptions.map((p) => ({
    weight: p.sets ?? 1,
    color: TONES[toneOf(p.exercise.category)],
  }));
}

export function seconds(n: number) {
  if (n < 60) return `${n} sec`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

/** Splits a prescription into a headline dose and supporting details. */
export function dose(p: Prescription) {
  const amount = p.holdSeconds
    ? `${seconds(p.holdSeconds)} hold`
    : p.reps
      ? `${p.reps} reps`
      : p.durationSeconds
        ? seconds(p.durationSeconds)
        : 'Own pace';
  const main = p.sets ? `${p.sets} × ${amount}` : amount;
  const details: string[] = [];
  if (p.side === 'both') details.push('Each side');
  else if (p.side) details.push(p.side === 'left' ? 'Left side' : 'Right side');
  if (p.load) details.push(p.load);
  if (p.restSeconds !== undefined && p.restSeconds > 0)
    details.push(`Rest ${seconds(p.restSeconds)}`);
  return { main, details };
}
