import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { DateTime } from 'luxon';
import {
  addDays,
  assessmentDue,
  dayInZone,
  programmeDay,
  type Assessment,
  type Programme,
  type Session,
} from '@rehab/core';
import { useStore } from '../../src/store';
import { Connect } from '../../src/connect';
import { currentProgrammes, sessionKind, shortTime, structure } from '../../src/helpers';
import {
  C,
  Card,
  Empty,
  Header,
  Icon,
  Loading,
  Row,
  Screen,
  SectionHeader,
  Stat,
  StructureBar,
  T,
  Tag,
  Tap,
  haptic,
  s,
  type IconName,
  type Tone,
} from '../../src/ui';

const TONE_ICON: Record<Tone, IconName> = {
  mobility: 'refresh-cw',
  strength: 'trending-up',
  balance: 'target',
  cardio: 'heart',
  other: 'activity',
};

export default function Today() {
  const { data, connection, ready } = useStore();
  const first = currentProgrammes(data)[0];
  const today = dayInZone(first?.timezone);
  const [selection, setSelection] = useState<string | null>(null);
  const date = selection ?? today;
  if (!ready) return <Loading />;
  if (!connection) return <Connect />;

  const programmes = currentProgrammes(data, date);
  const active =
    programmes.find(
      (p) => programmeDay(p, date) > 0 && programmeDay(p, date) <= p.durationWeeks * 7,
    ) ?? programmes[0];
  const byDate = (d: string) =>
    (data?.sessions.filter((x) => x.date === d) ?? []).sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt),
    );
  const sessions = byDate(date);
  const completed = sessions.filter((x) => x.status === 'completed').length;
  const minutes = sessions.reduce((n, x) => n + x.snapshot.estimatedMinutes, 0);
  const next = date === today ? sessions.find((x) => x.status === 'pending') : undefined;
  const outside = !!data && (date < data.from || date > data.to);
  const assessments =
    data?.assessments.filter((a) => {
      const p = programmes.find((p) => p.id === a.programmeId);
      return p && assessmentDue(a, p, date);
    }) ?? [];

  const d = DateTime.fromISO(date);
  const relative =
    date === today
      ? d.toFormat('cccc d LLLL')
      : (d.toRelativeCalendar({ base: DateTime.fromISO(today), unit: 'days' }) ?? '');

  return (
    <Screen>
      <Header
        overline={relative}
        title={date === today ? 'Today' : d.toFormat('ccc d LLL')}
        right={
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            scale={0.92}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: C.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T v="strong" weight="700" color="#FFF">
              {(data?.user.name ?? '?').slice(0, 1).toUpperCase()}
            </T>
          </Tap>
        }
      />

      <WeekStrip
        date={date}
        today={today}
        onSelect={(d) => setSelection(d === today ? null : d)}
        byDate={byDate}
      />

      {active && <ProgrammeStrip programme={active} date={date} />}

      <SectionHeader
        title="Sessions"
        aside={
          sessions.length ? `${completed} of ${sessions.length} done · ${minutes} min` : undefined
        }
      />
      {!active ? (
        <Empty
          icon="layers"
          title="No programme yet"
          body="Programmes added to your account appear here."
        />
      ) : outside ? (
        <Empty
          icon="cloud-off"
          title="Not stored on this device"
          body="The app keeps two years of history and the next 14 days. Go back to today to see your current plan."
        />
      ) : sessions.length === 0 ? (
        <Empty icon="moon" title="Rest day" body="No sessions scheduled." />
      ) : (
        <View style={{ gap: 10 }}>
          {sessions.map((x) =>
            x.id === next?.id ? (
              <NextSession key={x.id} session={x} />
            ) : (
              <SessionRow key={x.id} session={x} past={date < today} />
            ),
          )}
        </View>
      )}

      {!outside && assessments.length > 0 && (
        <>
          <SectionHeader title="Check-in" />
          <View style={{ gap: 10 }}>
            {assessments.map((a) => (
              <CheckInRow key={a.id} assessment={a} date={date} today={today} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function WeekStrip({
  date,
  today,
  onSelect,
  byDate,
}: {
  date: string;
  today: string;
  onSelect: (d: string) => void;
  byDate: (d: string) => Session[];
}) {
  const start = DateTime.fromISO(date).startOf('week').toISODate()!;
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <Card style={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8 }}>
      <Row style={{ justifyContent: 'space-between', paddingLeft: 10, marginBottom: 4 }}>
        <T v="strong">{DateTime.fromISO(date).toFormat('LLLL yyyy')}</T>
        <Row gap={2}>
          {date !== today && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptic.tap();
                onSelect(today);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: C.accentSoft,
                marginRight: 4,
              }}
            >
              <T v="caption" weight="700" color={C.accent}>
                Back to today
              </T>
            </Pressable>
          )}
          {(
            [
              ['chevron-left', 'Previous week', -7],
              ['chevron-right', 'Next week', 7],
            ] as const
          ).map(([icon, label, n]) => (
            <Pressable
              key={icon}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                haptic.tap();
                onSelect(addDays(date, n));
              }}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={icon} size={20} color={C.ink2} />
            </Pressable>
          ))}
        </Row>
      </Row>
      <Row gap={4}>
        {week.map((d) => {
          const on = d === date;
          const list = byDate(d);
          const done = list.filter((x) => x.status === 'completed').length;
          const dt = DateTime.fromISO(d);
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={dt.toFormat('cccc d LLLL')}
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic.tap();
                onSelect(d);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingTop: 8,
                paddingBottom: 10,
                gap: 4,
                borderRadius: 14,
                backgroundColor: on ? C.ink : 'transparent',
              }}
            >
              <T v="caption" size={11} color={on ? C.onDarkMuted : C.muted}>
                {dt.toFormat('ccc').slice(0, 3)}
              </T>
              <T
                v="strong"
                size={17}
                weight="700"
                color={on ? '#FFF' : d === today ? C.accent : C.ink}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {dt.day}
              </T>
              <View
                style={{
                  width: 18,
                  height: 4,
                  borderRadius: 2,
                  marginTop: 2,
                  overflow: 'hidden',
                  backgroundColor: list.length ? (on ? C.dark2 : C.fill) : 'transparent',
                }}
              >
                <View
                  style={{
                    width: list.length ? `${(done / list.length) * 100}%` : 0,
                    height: 4,
                    backgroundColor: on ? C.volt : C.good,
                  }}
                />
              </View>
            </Pressable>
          );
        })}
      </Row>
    </Card>
  );
}

function ProgrammeStrip({ programme: p, date }: { programme: Programme; date: string }) {
  const total = p.durationWeeks * 7;
  const day = programmeDay(p, date);
  const week = Math.min(p.durationWeeks, Math.max(1, Math.ceil(day / 7)));
  const phase = p.phases.find((ph) => week >= ph.startWeek && week <= ph.endWeek);
  const segments = p.phases.length
    ? p.phases.map((ph) => ({ from: (ph.startWeek - 1) * 7, to: ph.endWeek * 7 }))
    : [{ from: 0, to: total }];
  const status =
    day < 1
      ? `Starts ${DateTime.fromISO(p.startDate).toFormat('d LLL')}`
      : day > total
        ? 'Complete'
        : `Week ${week} of ${p.durationWeeks}`;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${status}. View plan`}
      onPress={() => router.push('/programme')}
      style={[s.card, { marginTop: 10, gap: 14 }]}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="caption" color={C.muted} numberOfLines={1}>
            {p.name}
          </T>
          <T v="strong" weight="700">
            {status}
            {phase && day >= 1 && day <= total ? (
              <T v="strong" color={C.muted}>
                {'  ·  '}
                {phase.name}
              </T>
            ) : null}
          </T>
        </View>
        <Icon name="chevron-right" size={20} color={C.faint} />
      </Row>
      <Row gap={3}>
        {segments.map((seg, i) => {
          const fill = Math.max(0, Math.min(1, (day - seg.from) / (seg.to - seg.from)));
          return (
            <View
              key={i}
              style={{
                flex: seg.to - seg.from,
                height: 6,
                borderRadius: 3,
                backgroundColor: C.fill,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: `${fill * 100}%`, height: 6, backgroundColor: C.ink }} />
            </View>
          );
        })}
      </Row>
    </Tap>
  );
}

function NextSession({ session }: { session: Session }) {
  const t = session.snapshot;
  const kind = sessionKind(t.prescriptions);
  return (
    <Tap
      accessibilityRole="button"
      onPress={() => router.push(`/session/${session.id}`)}
      scale={0.985}
      style={{ backgroundColor: C.dark, borderRadius: 24, padding: 20 }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Tag bg={C.dark2} color={C.volt}>
          Up next · {shortTime(t.time)}
        </Tag>
        <Tag bg={C.dark2} color="#FFF" dot={kind.color}>
          {kind.label}
        </Tag>
      </Row>
      <T v="title" color="#FFF" style={{ marginTop: 18 }}>
        {t.name}
      </T>
      <Row gap={28} style={{ marginTop: 16 }}>
        <Stat
          value={t.estimatedMinutes}
          unit="min"
          label="Duration"
          color="#FFF"
          sub={C.onDarkMuted}
          size={26}
        />
        <Stat
          value={t.prescriptions.length}
          label="Exercises"
          color="#FFF"
          sub={C.onDarkMuted}
          size={26}
        />
        <Stat
          value={t.prescriptions.reduce((n, p) => n + (p.sets ?? 1), 0)}
          label="Sets"
          color="#FFF"
          sub={C.onDarkMuted}
          size={26}
        />
      </Row>
      <View style={{ marginTop: 18 }}>
        <StructureBar segments={structure(t.prescriptions)} />
      </View>
      <View
        style={{
          marginTop: 20,
          backgroundColor: C.volt,
          borderRadius: 16,
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <T v="strong" size={16} weight="700">
          Start session
        </T>
        <Icon name="arrow-right" size={18} />
      </View>
    </Tap>
  );
}

function SessionRow({ session, past }: { session: Session; past: boolean }) {
  const t = session.snapshot;
  const kind = sessionKind(t.prescriptions);
  const done = session.status === 'completed';
  const skipped = session.status === 'skipped';
  const missed = !done && !skipped && past;
  return (
    <Tap
      accessibilityRole="button"
      onPress={() => router.push(`/session/${session.id}`)}
      style={[s.card, { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: done ? C.good : skipped || missed ? C.fill : `${kind.color}1C`,
        }}
      >
        <Icon
          name={done ? 'check' : skipped ? 'minus' : TONE_ICON[kind.tone]}
          size={20}
          color={done ? '#FFF' : skipped || missed ? C.muted : kind.color}
        />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T v="caption" color={C.muted} style={{ fontVariant: ['tabular-nums'] }}>
          {shortTime(t.time)} · {kind.label}
        </T>
        <T
          v="strong"
          size={16}
          weight="700"
          color={done || skipped ? C.ink2 : C.ink}
          style={skipped ? { textDecorationLine: 'line-through' } : undefined}
        >
          {t.name}
        </T>
        <T v="caption" color={C.muted}>
          {t.prescriptions.length} exercises · {t.estimatedMinutes} min
        </T>
      </View>
      {done ? (
        <Tag color={C.good} bg={C.goodSoft}>
          Done
        </Tag>
      ) : skipped ? (
        <Tag>Skipped</Tag>
      ) : missed ? (
        <Tag color={C.warn} bg={C.warnSoft}>
          Not recorded
        </Tag>
      ) : (
        <Icon name="chevron-right" size={20} color={C.faint} />
      )}
    </Tap>
  );
}

function CheckInRow({
  assessment: a,
  date,
  today,
}: {
  assessment: Assessment;
  date: string;
  today: string;
}) {
  const { data } = useStore();
  const response = data?.responses
    .filter((r) => r.assessmentId === a.id && r.date === date)
    .sort((x, y) => y.occurredAt.localeCompare(x.occurredAt))[0];
  const future = date > today;
  const summary = response
    ? a.fields
        .filter((f) => f.type === 'numericScale' && typeof response.answers[f.id] === 'number')
        .slice(0, 3)
        .map((f) => `${f.label} ${response.answers[f.id]}`)
        .join(' · ') || 'Recorded'
    : `${a.fields.length} questions`;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityState={{ disabled: future }}
      disabled={future}
      onPress={() => router.push(`/assessment/${a.id}?date=${date}`)}
      style={[s.card, { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: response ? C.good : C.accentSoft,
        }}
      >
        <Icon
          name={response ? 'check' : 'clipboard'}
          size={20}
          color={response ? '#FFF' : C.accent}
        />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T v="strong" size={16} weight="700">
          {a.name}
        </T>
        <T v="caption" color={C.muted}>
          {future ? 'Opens on the day' : summary}
        </T>
      </View>
      {response ? (
        <Tag color={C.good} bg={C.goodSoft}>
          Done
        </Tag>
      ) : future ? null : (
        <Tag color={C.accent} bg={C.accentSoft}>
          Due
        </Tag>
      )}
    </Tap>
  );
}
