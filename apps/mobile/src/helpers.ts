import { DateTime } from 'luxon';
import { dayInZone, type Dashboard, type Programme } from '@rehab/core';
export function currentProgrammes(data: Dashboard | null, date?: string) {
  const map = new Map<string, Programme>();
  for (const p of data?.programmes ?? []) {
    const d = date ?? dayInZone(p.timezone);
    if (p.effectiveDate <= d || !map.has(p.id)) map.set(p.id, p);
  }
  return [...map.values()];
}
export const formatTime = (time: string) => DateTime.fromFormat(time, 'HH:mm').toFormat('h:mm a');
export const dateLabel = (date: string) => DateTime.fromISO(date).toFormat('cccc, d LLLL');
