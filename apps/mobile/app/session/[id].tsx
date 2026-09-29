import React, { useState } from 'react';
import { View, Pressable, Linking, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { DateTime } from 'luxon';
import { dayInZone, prescriptionLabel } from '@rehab/core';
import { useStore } from '../../src/store';
import { currentProgrammes, formatTime } from '../../src/helpers';
import {
  Back,
  Button,
  C,
  Card,
  Empty,
  Icon,
  Label,
  Pill,
  Row,
  Screen,
  Section,
  T,
  s,
} from '../../src/ui';
export default function Session() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const session = store.data?.sessions.find((s) => s.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [reminderTime, setReminderTime] = useState('');
  const [notice, setNotice] = useState('');
  if (!session)
    return (
      <Screen>
        <Back />
        <Empty
          title="Session not available"
          body="Connect your account and refresh your plan to load this session."
        />
      </Screen>
    );
  const p = currentProgrammes(store.data, session.date).find((p) => p.id === session.programmeId);
  const future = session.date > dayInZone(p?.timezone);
  const assessments =
    store.data?.assessments.filter(
      (a) => a.programmeId === session.programmeId && a.trigger === 'afterSession',
    ) ?? [];
  async function record(status: 'completed' | 'skipped' | 'pending') {
    setBusy(true);
    setError('');
    try {
      await store.complete(session!, status);
    } catch {
      setError('We couldn’t save on this device. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Back title="Your daily plan" />
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Label>{DateTime.fromISO(session.date).toFormat('cccc, d LLL')}</Label>
        <Pill>
          {session.status === 'completed'
            ? 'Completed'
            : session.status === 'skipped'
              ? 'Skipped'
              : formatTime(session.snapshot.time)}
        </Pill>
      </Row>
      <T serif size={37} style={{ letterSpacing: -1, lineHeight: 43 }}>
        {session.snapshot.name}
      </T>
      <Row style={{ marginTop: 16, marginBottom: 25 }}>
        <Icon name="clock" size={15} color={C.muted} />
        <T size={13} color={C.muted}>
          {session.snapshot.estimatedMinutes} min
        </T>
        <T color={C.muted}>·</T>
        <T size={13} color={C.muted}>
          {session.snapshot.prescriptions.length} exercises
        </T>
      </Row>
      <Card style={{ backgroundColor: C.pale, borderColor: C.pale, padding: 18 }}>
        <Row>
          <Icon name="feather" size={20} />
          <T size={13} style={{ flex: 1, lineHeight: 20 }}>
            Make this time yours. Work through the exercises at your own pace, following your
            prescribed plan.
          </T>
        </Row>
      </Card>
      <Section title="Your exercises" aside={<Label>IN YOUR OWN TIME</Label>} />
      <View style={{ gap: 14 }}>
        {session.snapshot.prescriptions.map((pr, i) => {
          const open = expanded.includes(String(i));
          return (
            <Card key={i} style={{ padding: 20 }}>
              <Row style={{ alignItems: 'flex-start', gap: 14 }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: C.pale,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T size={12} weight="600">
                    {String(i + 1).padStart(2, '0')}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T size={17} weight="600">
                    {pr.exercise.name}
                  </T>
                  <T size={14} color={C.green} style={{ marginTop: 7 }}>
                    {prescriptionLabel(pr)}
                  </T>
                  {pr.restSeconds !== undefined && (
                    <T size={12} color={C.muted} style={{ marginTop: 5 }}>
                      Rest {pr.restSeconds} sec between sets
                    </T>
                  )}
                  {pr.notes && (
                    <T size={13} style={{ marginTop: 10 }}>
                      {pr.notes}
                    </T>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    onPress={() =>
                      setExpanded((old) =>
                        open ? old.filter((x) => x !== String(i)) : [...old, String(i)],
                      )
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingTop: 15,
                      paddingBottom: 4,
                    }}
                  >
                    <T size={12} color={C.muted}>
                      {open ? 'Hide instructions' : 'How to do it'}
                    </T>
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} color={C.muted} />
                  </Pressable>
                </View>
              </Row>
              {open && (
                <View
                  style={{
                    gap: 13,
                    marginTop: 18,
                    borderTopWidth: 1,
                    borderTopColor: C.line,
                    paddingTop: 18,
                  }}
                >
                  {pr.exercise.description && (
                    <T size={13} color={C.muted}>
                      {pr.exercise.description}
                    </T>
                  )}
                  {pr.exercise.equipment && <Pill>Equipment · {pr.exercise.equipment}</Pill>}
                  {pr.exercise.imageUrl && (
                    <Image
                      source={{ uri: pr.exercise.imageUrl }}
                      style={{ height: 180, width: '100%', borderRadius: 12 }}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      accessibilityLabel={pr.exercise.name}
                    />
                  )}
                  {pr.exercise.instructions.map((step, n) => (
                    <Row key={n} style={{ alignItems: 'flex-start' }}>
                      <T size={12} color={C.muted}>
                        {n + 1}.
                      </T>
                      <T size={14} style={{ flex: 1, lineHeight: 22 }}>
                        {step}
                      </T>
                    </Row>
                  ))}
                  {pr.exercise.videoUrl && (
                    <Button
                      title="Watch exercise video"
                      secondary
                      icon="play"
                      onPress={() => void Linking.openURL(pr.exercise.videoUrl!)}
                    />
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </View>
      <View style={{ gap: 12, marginTop: 26 }}>
        {!!error && <T color={C.red}>{error}</T>}
        {session.status === 'pending' ? (
          <>
            <Button
              title={busy ? 'Saving…' : 'Mark session complete'}
              icon="check"
              disabled={busy || future}
              onPress={() => void record('completed')}
            />
            <Button
              title="Skip this session"
              secondary
              disabled={busy || future}
              onPress={() => void record('skipped')}
            />
          </>
        ) : (
          <>
            <Card
              style={{
                backgroundColor: C.pale,
                borderColor: C.pale,
                alignItems: 'center',
                gap: 10,
                padding: 24,
              }}
            >
              <Icon
                name={session.status === 'completed' ? 'check-circle' : 'minus-circle'}
                size={30}
              />
              <T serif size={25}>
                {session.status === 'completed' ? 'A little stronger.' : 'Space for a rest.'}
              </T>
              <T color={C.muted} size={13}>
                {session.status === 'completed'
                  ? 'Your session is recorded. Well done for showing up.'
                  : 'Your skipped session is recorded.'}
              </T>
            </Card>
            {session.status === 'completed' &&
              assessments.map((a) => (
                <Button
                  key={a.id}
                  title={a.name}
                  icon="heart"
                  onPress={() =>
                    router.push(`/assessment/${a.id}?date=${session.date}&sessionId=${session.id}`)
                  }
                />
              ))}
            <Button title="Back to today" icon="arrow-left" onPress={() => router.replace('/')} />
            <Pressable
              disabled={busy}
              onPress={() => void record('pending')}
              style={{ padding: 14, alignItems: 'center' }}
            >
              <T size={13} color={C.muted}>
                Undo {session.status === 'completed' ? 'completion' : 'skip'}
              </T>
            </Pressable>
          </>
        )}
        {future && (
          <T color={C.muted} size={12}>
            You can record this session on its scheduled day.
          </T>
        )}
      </View>
      {session.status === 'pending' && (
        <>
          <Section title="A gentle reminder" />
          <Card style={{ gap: 14 }}>
            <T color={C.muted} size={13}>
              Choose a reminder time for this session in {p?.timezone ?? 'your programme timezone'}.
            </T>
            <TextInput
              accessibilityLabel="Reminder time"
              style={s.input}
              placeholder="HH:MM"
              value={reminderTime}
              onChangeText={setReminderTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Button
              secondary
              title="Change reminder time"
              disabled={!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)}
              onPress={() => {
                const t = DateTime.fromISO(`${session.date}T${reminderTime}`, {
                  zone: p?.timezone,
                });
                if (t.toMillis() <= Date.now()) {
                  setNotice('Choose a time in the future.');
                  return;
                }
                store
                  .reminder(session, t.toUTC().toISO()!)
                  .then(() =>
                    setNotice('Reminder time saved. Enable reminders in Settings to receive it.'),
                  )
                  .catch(() => setNotice('Could not save. Try again.'));
              }}
            />
            <Button
              secondary
              title="Snooze for 15 minutes"
              onPress={() => {
                store
                  .reminder(session, new Date(Date.now() + 15 * 60000).toISOString())
                  .then(() => setNotice('Snoozed. Enable reminders in Settings to receive it.'))
                  .catch(() => setNotice('Could not save. Try again.'));
              }}
            />
            {session.reminderAt && (
              <T size={12} color={C.muted}>
                Reminder:{' '}
                {DateTime.fromISO(session.reminderAt)
                  .setZone(p?.timezone)
                  .toFormat('d LLL, h:mm a')}
              </T>
            )}
            {!!notice && (
              <T size={12} color={C.green}>
                {notice}
              </T>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
