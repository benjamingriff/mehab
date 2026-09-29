import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { DateTime } from 'luxon';
import { addDays, assessmentDue, type Dashboard } from '@rehab/core';
import { useStore } from './store';
if (Platform.OS !== 'web')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
export async function askReminders() {
  if (Platform.OS === 'web') throw new Error('Local reminders are available in the iPhone app.');
  const p = await Notifications.requestPermissionsAsync();
  if (!p.granted) throw new Error('Allow notifications in iPhone Settings to enable reminders.');
  return true;
}
export async function testReminder() {
  await askReminders();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'A little time for you', body: 'Your rehab reminders are ready.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10 },
  });
}
let scheduling = Promise.resolve();
function schedule(data: Dashboard | null, enabled: boolean) {
  scheduling = scheduling
    .catch(() => {})
    .then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!enabled || !data) return;
      const p = await Notifications.getPermissionsAsync();
      if (!p.granted) throw new Error('Notifications are disabled in iPhone Settings.');
      const entries = data.sessions
        .filter(
          (s) =>
            s.status === 'pending' &&
            new Date(s.reminderAt ?? s.scheduledAt).getTime() > Date.now(),
        )
        .map((s) => ({
          date: new Date(s.reminderAt ?? s.scheduledAt),
          content: {
            title: 'A little time for your rehab',
            body: `${s.snapshot.name} · ${s.snapshot.estimatedMinutes} min`,
            data: { sessionId: s.id, url: `/session/${s.id}` },
            categoryIdentifier: 'session',
          },
        }));
      for (let d = data.from; d <= data.to; d = addDays(d, 1)) {
        for (const a of data.assessments) {
          const p = data.programmes
            .filter((p) => p.id === a.programmeId && p.effectiveDate <= d)
            .at(-1);
          if (
            !p ||
            !assessmentDue(a, p, d) ||
            data.responses.some((r) => r.assessmentId === a.id && r.date === d)
          )
            continue;
          const at = DateTime.fromISO(`${d}T${a.time}`, { zone: p.timezone }).toJSDate();
          if (at.getTime() > Date.now())
            entries.push({
              date: at,
              content: {
                title: 'How are you feeling?',
                body: a.name,
                data: { sessionId: '', url: `/assessment/${a.id}?date=${d}` },
                categoryIdentifier: 'assessment',
              },
            });
        }
      }
      // iOS has a finite pending notification budget. Refill the next 60 reminders on every foreground sync.
      for (const e of entries.sort((a, b) => +a.date - +b.date).slice(0, 60))
        await Notifications.scheduleNotificationAsync({
          content: e.content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: e.date },
        });
    });
  return scheduling;
}
export function NotificationManager() {
  const store = useStore();
  const ref = useRef(store);
  ref.current = store;
  const handled = useRef(new Set<string>());
  const [signature] = [
    JSON.stringify([
      store.reminders,
      store.lastSync,
      store.data?.sessions.map((s) => [s.id, s.status, s.scheduledAt, s.reminderAt]),
      store.data?.assessments,
      store.data?.responses.map((r) => r.id),
    ]),
  ];
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void schedule(store.data, store.reminders)
      .then(() => store.setNotificationError(null))
      .catch((e) => store.setNotificationError(e.message ?? 'Could not schedule reminders.'));
  }, [signature]);
  useEffect(() => {
    if (Platform.OS === 'web' || !store.ready || !store.data) return;
    void Notifications.setNotificationCategoryAsync('session', [
      {
        identifier: 'SNOOZE',
        buttonTitle: 'Remind me in 15 min',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'COMPLETE',
        buttonTitle: 'Mark complete',
        options: { opensAppToForeground: true },
      },
      { identifier: 'SKIP', buttonTitle: 'Skip session', options: { opensAppToForeground: true } },
    ]);
    async function handle(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const key = response.notification.request.identifier + response.actionIdentifier;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      const data = response.notification.request.content.data ?? {};
      const s = ref.current.data?.sessions.find((s) => s.id === data.sessionId);
      try {
        if (s && response.actionIdentifier === 'SNOOZE')
          await ref.current.reminder(s, new Date(Date.now() + 15 * 60000).toISOString());
        else if (s && response.actionIdentifier === 'COMPLETE')
          await ref.current.complete(s, 'completed');
        else if (s && response.actionIdentifier === 'SKIP')
          await ref.current.complete(s, 'skipped');
        else if (
          typeof data.url === 'string' &&
          /^\/(session|assessment)\/[a-f0-9-]+/.test(data.url)
        )
          router.push(data.url as any);
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        ref.current.setNotificationError(
          'Could not save the notification action. Open the session and try again.',
        );
        handled.current.delete(key);
      }
    }
    void Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handle(r));
    return () => sub.remove();
  }, [store.ready, !!store.data]);
  return null;
}
