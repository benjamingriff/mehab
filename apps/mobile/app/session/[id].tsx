import React, { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { DateTime } from 'luxon';
import { dayInZone, type Prescription, type Session as SessionT } from '@rehab/core';
import { useStore } from '../../src/store';
import {
  currentProgrammes,
  dose,
  sessionKind,
  shortTime,
  structure,
  toneOf,
} from '../../src/helpers';
import {
  Button,
  C,
  Card,
  Divider,
  Empty,
  Icon,
  Row,
  Screen,
  SectionHeader,
  Stat,
  StructureBar,
  T,
  TONES,
  Tag,
  TopBar,
  haptic,
  s,
} from '../../src/ui';

export default function Session() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const session = store.data?.sessions.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session)
    return (
      <Screen>
        <TopBar />
        <Empty
          icon="alert-circle"
          title="Session not available"
          body="Connect your account and refresh to load this session."
        />
      </Screen>
    );
  const p = currentProgrammes(store.data, session.date).find((x) => x.id === session.programmeId);
  const future = session.date > dayInZone(p?.timezone);
  const t = session.snapshot;
  const kind = sessionKind(t.prescriptions);
  const pending = session.status === 'pending';
  const assessments =
    store.data?.assessments.filter(
      (a) => a.programmeId === session.programmeId && a.trigger === 'afterSession',
    ) ?? [];
  async function record(status: SessionT['status']) {
    setBusy(true);
    setError('');
    try {
      await store.complete(session!, status);
      if (status === 'completed') haptic.success();
      else haptic.press();
    } catch {
      setError('Couldn’t save on this device. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const footer = pending ? (
    <View style={{ gap: 8 }}>
      {!!error && (
        <T v="caption" color={C.bad} align="center">
          {error}
        </T>
      )}
      {future && (
        <T v="caption" color={C.muted} align="center">
          You can record this session on {DateTime.fromISO(session.date).toFormat('cccc d LLL')}.
        </T>
      )}
      <Row gap={10}>
        <Button
          title="Skip"
          label="Skip this session"
          kind="secondary"
          disabled={busy || future}
          onPress={() => void record('skipped')}
          style={{ paddingHorizontal: 22 }}
        />
        <Button
          title={busy ? 'Saving…' : 'Mark session complete'}
          icon="check"
          disabled={busy || future}
          onPress={() => void record('completed')}
          wrap={{ flex: 1 }}
        />
      </Row>
    </View>
  ) : (
    <Button title="Back to today" kind="primary" onPress={() => router.dismissTo('/')} />
  );

  return (
    <Screen footer={footer}>
      <TopBar
        right={
          <T v="caption" color={C.muted}>
            {DateTime.fromISO(session.date).toFormat('ccc d LLL')} · {shortTime(t.time)}
          </T>
        }
      />
      <Row>
        <Tag dot={kind.color} bg={C.surface}>
          {kind.label}
        </Tag>
      </Row>
      <T v="display" style={{ marginTop: 12 }} accessibilityRole="header">
        {t.name}
      </T>
      <Row gap={0} style={{ marginTop: 20 }}>
        {[
          { value: t.estimatedMinutes, unit: 'min', label: 'Duration' },
          { value: t.prescriptions.length, label: 'Exercises' },
          { value: t.prescriptions.reduce((n, x) => n + (x.sets ?? 1), 0), label: 'Sets' },
        ].map((x, i) => (
          <View
            key={x.label}
            style={{
              flex: 1,
              paddingLeft: i ? 16 : 0,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: C.line,
            }}
          >
            <Stat {...x} size={28} />
          </View>
        ))}
      </Row>
      <View style={{ marginTop: 20 }}>
        <StructureBar segments={structure(t.prescriptions)} height={10} />
      </View>

      {!pending && (
        <StatusCard
          session={session}
          busy={busy}
          timezone={p?.timezone}
          onUndo={() => void record('pending')}
        />
      )}
      {session.status === 'completed' && assessments.length > 0 && (
        <View style={{ gap: 10, marginTop: 10 }}>
          {assessments.map((a) => (
            <Button
              key={a.id}
              title={a.name}
              icon="clipboard"
              kind="secondary"
              onPress={() =>
                router.push(`/assessment/${a.id}?date=${session.date}&sessionId=${session.id}`)
              }
            />
          ))}
        </View>
      )}

      <SectionHeader title="Exercises" aside={`${t.prescriptions.length} total`} />
      <View style={{ gap: 10 }}>
        {t.prescriptions.map((pr, i) => (
          <ExerciseCard key={i} index={i} prescription={pr} />
        ))}
      </View>

      {pending && <Reminder session={session} timezone={p?.timezone} />}
    </Screen>
  );
}

function StatusCard({
  session,
  busy,
  timezone,
  onUndo,
}: {
  session: SessionT;
  busy: boolean;
  timezone?: string;
  onUndo: () => void;
}) {
  const done = session.status === 'completed';
  const recorded = session.completedAt
    ? DateTime.fromISO(session.completedAt).setZone(timezone)
    : undefined;
  const fg = done ? '#FFF' : C.ink;
  const sub = done ? 'rgba(255,255,255,0.78)' : C.muted;
  return (
    <Card style={{ marginTop: 20, backgroundColor: done ? C.good : C.surface, gap: 14 }}>
      <Row gap={14}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: done ? 'rgba(255,255,255,0.18)' : C.fill,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={done ? 'check' : 'minus'} size={22} color={fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="headline" color={fg}>
            {done ? 'Session complete' : 'Session skipped'}
          </T>
          {recorded && (
            <T v="caption" color={sub}>
              Recorded{' '}
              {recorded.toISODate() === session.date
                ? `at ${recorded.toFormat('HH:mm')}`
                : recorded.toFormat('ccc d LLL, HH:mm')}
            </T>
          )}
        </View>
      </Row>
      <View
        style={{
          height: 1,
          backgroundColor: done ? 'rgba(255,255,255,0.18)' : C.line,
        }}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onUndo}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Icon name="rotate-ccw" size={15} color={fg} />
        <T v="caption" size={13} weight="700" color={fg}>
          {done ? 'Undo completion' : 'Undo skip'}
        </T>
      </Pressable>
    </Card>
  );
}

function ExerciseCard({ index, prescription: pr }: { index: number; prescription: Prescription }) {
  const [open, setOpen] = useState(false);
  const { main, details } = dose(pr);
  const ex = pr.exercise;
  const tone = TONES[toneOf(ex.category)];
  const hasHow = !!ex.description || ex.instructions.length > 0 || !!ex.imageUrl || !!ex.videoUrl;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: tone }} />
        <View style={{ flex: 1, padding: 16, paddingLeft: 14 }}>
          <Row style={{ alignItems: 'flex-start' }} gap={12}>
            <T
              v="caption"
              weight="700"
              color={C.faint}
              style={{ fontVariant: ['tabular-nums'], marginTop: 3, width: 20 }}
            >
              {String(index + 1).padStart(2, '0')}
            </T>
            <View style={{ flex: 1 }}>
              <T v="strong" size={17} weight="700">
                {ex.name}
              </T>
              <T
                v="headline"
                size={22}
                weight="800"
                style={{ marginTop: 6, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}
              >
                {main}
              </T>
              {(details.length > 0 || ex.equipment) && (
                <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 10 }}>
                  {details.map((d) => (
                    <Tag key={d}>{d}</Tag>
                  ))}
                  {ex.equipment && <Tag icon="package">{ex.equipment}</Tag>}
                </Row>
              )}
              {!!pr.notes && (
                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: C.accentSoft,
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <Icon name="info" size={15} color={C.accent} />
                  <T v="callout" style={{ flex: 1 }}>
                    {pr.notes}
                  </T>
                </View>
              )}
            </View>
          </Row>
          {hasHow && (
            <>
              <Divider style={{ marginTop: 14 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={open ? 'Hide instructions' : 'How to do it'}
                accessibilityState={{ expanded: open }}
                onPress={() => {
                  haptic.tap();
                  setOpen(!open);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                }}
              >
                <T v="caption" size={13} weight="600" color={C.ink2}>
                  {open ? 'Hide instructions' : 'How to do it'}
                </T>
                <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.ink2} />
              </Pressable>
            </>
          )}
          {open && (
            <View style={{ gap: 12, marginTop: 14 }}>
              {!!ex.description && (
                <T v="callout" color={C.ink2}>
                  {ex.description}
                </T>
              )}
              {ex.imageUrl && (
                <Image
                  source={{ uri: ex.imageUrl }}
                  style={{ height: 200, width: '100%', borderRadius: 14, backgroundColor: C.fill }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  accessibilityLabel={ex.name}
                />
              )}
              {ex.instructions.map((step, n) => (
                <Row key={n} style={{ alignItems: 'flex-start' }} gap={12}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: C.ink,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    <T v="caption" size={11} weight="700" color="#FFF">
                      {n + 1}
                    </T>
                  </View>
                  <T v="body" style={{ flex: 1 }}>
                    {step}
                  </T>
                </Row>
              ))}
              {ex.videoUrl && (
                <Button
                  title="Watch video"
                  kind="secondary"
                  icon="play"
                  small
                  onPress={() => void Linking.openURL(ex.videoUrl!)}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

function Reminder({ session, timezone }: { session: SessionT; timezone?: string }) {
  const store = useStore();
  const [time, setTime] = useState('');
  const [notice, setNotice] = useState('');
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  function save(at: DateTime, message: string) {
    if (at.toMillis() <= Date.now()) {
      setNotice('Choose a time in the future.');
      return;
    }
    store
      .reminder(session, at.toUTC().toISO()!)
      .then(() => {
        haptic.press();
        setTime('');
        setNotice(
          store.reminders ? message : `${message} Turn on reminders in Settings to receive it.`,
        );
      })
      .catch(() => setNotice('Couldn’t save. Try again.'));
  }
  const current = session.reminderAt
    ? DateTime.fromISO(session.reminderAt).setZone(timezone).toFormat('HH:mm')
    : shortTime(session.snapshot.time);
  return (
    <>
      <SectionHeader title="Reminder" aside={current} />
      <Card style={{ gap: 12 }}>
        <Row gap={10}>
          <TextInput
            accessibilityLabel="Reminder time"
            style={[s.input, { flex: 1, minWidth: 0, backgroundColor: C.bg, borderColor: C.bg }]}
            placeholder="HH:MM"
            placeholderTextColor={C.faint}
            value={time}
            onChangeText={setTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Button
            title="Set time"
            label="Change reminder time"
            kind="primary"
            disabled={!valid}
            style={{ minHeight: 52 }}
            onPress={() =>
              save(
                DateTime.fromISO(`${session.date}T${time}`, { zone: timezone }),
                `Reminder set for ${time}.`,
              )
            }
          />
        </Row>
        <Button
          title="Snooze 15 minutes"
          label="Snooze for 15 minutes"
          kind="secondary"
          icon="clock"
          small
          onPress={() => save(DateTime.now().plus({ minutes: 15 }), 'Snoozed for 15 minutes.')}
        />
        {!!notice && (
          <T v="caption" color={C.ink2}>
            {notice}
          </T>
        )}
      </Card>
    </>
  );
}
