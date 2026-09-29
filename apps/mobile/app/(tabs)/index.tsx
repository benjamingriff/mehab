import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DateTime } from 'luxon';
import { dayInZone, addDays, programmeDay, assessmentDue } from '@rehab/core';
import { useStore } from '../../src/store';
import { Connect } from '../../src/connect';
import { currentProgrammes, formatTime } from '../../src/helpers';
import {
  Screen,
  T,
  C,
  Icon,
  Row,
  Label,
  Section,
  Card,
  Pill,
  Botanical,
  Ring,
  Empty,
  Loading,
} from '../../src/ui';
export default function Today() {
  const { data, connection, ready } = useStore();
  const p = currentProgrammes(data)[0];
  const today = dayInZone(p?.timezone);
  const [selection, setSelection] = useState<string | null>(null);
  const date = selection ?? today;
  const programmes = currentProgrammes(data, date);
  const active =
    programmes.find(
      (p) => programmeDay(p, date) > 0 && programmeDay(p, date) <= p.durationWeeks * 7,
    ) ?? programmes[0];
  const sessions = data?.sessions.filter((s) => s.date === date) ?? [];
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const start = DateTime.fromISO(date).startOf('week').toISODate()!;
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  if (!ready) return <Loading />;
  if (!connection) return <Connect />;
  const day = active ? programmeDay(active, date) : 0;
  const phase = active?.phases.find(
    (p) => Math.ceil(day / 7) >= p.startWeek && Math.ceil(day / 7) <= p.endWeek,
  );
  const hour = DateTime.now().setZone(p?.timezone ?? 'Europe/London').hour;
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  const assessments =
    data?.assessments.filter((a) => {
      const p = programmes.find((p) => p.id === a.programmeId);
      return p && assessmentDue(a, p, date);
    }) ?? [];
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 27, marginTop: 6 }}>
        <Row>
          <Icon name="sun" size={22} />
          <T size={20} weight="600" style={{ letterSpacing: -0.6 }}>
            rehab
          </T>
        </Row>
        <Pressable
          accessibilityLabel="Open settings"
          onPress={() => router.push('/settings')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: C.pale,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T size={12} weight="700">
            {(data?.user.name ?? 'Y').slice(0, 1).toUpperCase()}
          </T>
        </Pressable>
      </Row>
      <Label>{DateTime.fromISO(date).toFormat('cccc, d LLLL')}</Label>
      <T serif size={37} style={{ letterSpacing: -1.1, marginTop: 7 }}>
        {date === today ? greeting : 'A little time for you.'}
      </T>
      <T color={C.muted} style={{ marginTop: 6, marginBottom: 24 }}>
        Small steps. Steady progress.
      </T>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Pressable
          accessibilityLabel="Previous week"
          onPress={() => setSelection(addDays(date, -7))}
          hitSlop={12}
        >
          <Icon name="chevron-left" size={16} color={C.muted} />
        </Pressable>
        <T size={12} color={C.muted}>
          {DateTime.fromISO(date).toFormat('LLLL yyyy')}
        </T>
        <Pressable
          accessibilityLabel="Next week"
          onPress={() => setSelection(addDays(date, 7))}
          hitSlop={12}
        >
          <Icon name="chevron-right" size={16} color={C.muted} />
        </Pressable>
      </Row>
      <Row style={{ gap: 6, marginBottom: 24 }}>
        {week.map((d) => {
          const selected = d === date;
          const list = data?.sessions.filter((s) => s.date === d) ?? [];
          const done = list.length > 0 && list.every((s) => s.status === 'completed');
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={DateTime.fromISO(d).toFormat('cccc d LLLL')}
              accessibilityState={{ selected }}
              onPress={() => setSelection(d)}
              style={{
                flex: 1,
                alignItems: 'center',
                borderRadius: 22,
                paddingVertical: 12,
                gap: 8,
                backgroundColor: selected ? C.green : 'transparent',
              }}
            >
              <T size={10} color={selected ? '#DFE7D8' : C.muted}>
                {DateTime.fromISO(d).toFormat('ccccc')}
              </T>
              <T size={16} weight="600" color={selected ? 'white' : C.ink}>
                {DateTime.fromISO(d).day}
              </T>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: done
                    ? selected
                      ? C.lime
                      : C.green
                    : d === today
                      ? selected
                        ? 'white'
                        : C.green
                      : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </Row>
      {date !== today && (
        <Pressable
          onPress={() => setSelection(null)}
          style={{ alignSelf: 'center', marginBottom: 16 }}
        >
          <T color={C.green} size={12}>
            Back to today
          </T>
        </Pressable>
      )}
      {active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View programme"
          onPress={() => router.push('/programme')}
          style={{
            backgroundColor: C.green,
            borderRadius: 23,
            padding: 24,
            overflow: 'hidden',
            minHeight: 184,
          }}
        >
          <View style={{ position: 'absolute', right: -14, top: 12, opacity: 0.55 }}>
            <Botanical size={175} />
          </View>
          <Row style={{ marginBottom: 15 }}>
            <View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: C.lime }} />
            <T size={10} color={C.lime} weight="600" style={{ letterSpacing: 1.6 }}>
              YOUR PROGRAMME
            </T>
          </Row>
          <T serif size={29} color="white" style={{ maxWidth: '77%', lineHeight: 33 }}>
            {active.name}
          </T>
          <T size={12} color="#D1DDCF" style={{ marginTop: 12 }}>
            {day < 1
              ? `Starts ${DateTime.fromISO(active.startDate).toFormat('d LLL')}`
              : day > active.durationWeeks * 7
                ? 'Programme complete'
                : `Day ${day} of ${active.durationWeeks * 7}`}{' '}
            · {phase?.name ?? `${active.durationWeeks} weeks`}
          </T>
          <View style={{ height: 3, backgroundColor: '#587C67', borderRadius: 4, marginTop: 22 }}>
            <View
              style={{
                height: 3,
                width: `${Math.max(0, Math.min(100, (day / (active.durationWeeks * 7)) * 100))}%`,
                backgroundColor: C.lime,
                borderRadius: 4,
              }}
            />
          </View>
        </Pressable>
      ) : (
        <Empty
          title="A fresh beginning"
          body="Your programme will appear here when it’s added to your account."
        />
      )}
      <Section
        title={date === today ? 'Your plan for today' : 'Your daily plan'}
        aside={
          <T color={C.muted} size={12}>
            {sessions.reduce((n, s) => n + s.snapshot.estimatedMinutes, 0)} min total
          </T>
        }
      />
      {data && (date < data.from || date > data.to) ? (
        <Empty
          title="Outside your saved calendar"
          body="Your app keeps two years of history and the next two weeks ready. Return to today to see your current plan."
        />
      ) : sessions.length === 0 ? (
        <Empty title="Room to rest" body="There are no sessions scheduled for this day." />
      ) : (
        <View style={{ gap: 11 }}>
          {sessions.map((session, i) => {
            const done = session.status === 'completed';
            const skip = session.status === 'skipped';
            const next =
              !done && !skip && sessions.find((s) => s.status === 'pending')?.id === session.id;
            return (
              <Pressable
                key={session.id}
                accessibilityRole="button"
                onPress={() => router.push(`/session/${session.id}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <Card
                  style={{
                    padding: 17,
                    backgroundColor: done ? '#F1F4EC' : C.paper,
                    borderColor: next ? '#CBD8C4' : C.line,
                  }}
                >
                  <Row style={{ gap: 14 }}>
                    <View
                      style={{
                        width: 39,
                        height: 39,
                        borderRadius: 13,
                        backgroundColor: done ? C.green : skip ? C.sand : C.pale,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Icon
                        name={
                          done
                            ? 'check'
                            : skip
                              ? 'minus'
                              : i === sessions.length - 1
                                ? 'activity'
                                : i === 0
                                  ? 'sunrise'
                                  : i === 1
                                    ? 'sun'
                                    : 'sunset'
                        }
                        size={18}
                        color={done ? 'white' : C.green}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T
                        size={10}
                        color={C.muted}
                        weight="500"
                        style={{ marginBottom: 4, letterSpacing: 0.5 }}
                      >
                        {formatTime(session.snapshot.time)}
                        {next && date === today ? '   ·   UP NEXT' : ''}
                      </T>
                      <T size={15} weight="600">
                        {session.snapshot.name}
                      </T>
                      <T size={11} color={C.muted} style={{ marginTop: 4 }}>
                        {session.snapshot.prescriptions.length} exercises ·{' '}
                        {session.snapshot.estimatedMinutes} min
                      </T>
                    </View>
                    {done ? (
                      <Icon name="check-circle" size={18} color={C.green} />
                    ) : skip ? (
                      <T size={11} color={C.muted}>
                        Skipped
                      </T>
                    ) : (
                      <Icon name="chevron-right" size={19} color={C.muted} />
                    )}
                  </Row>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
      {sessions.length > 0 && (
        <Row style={{ paddingTop: 20, paddingHorizontal: 5, gap: 14 }}>
          <View>
            <Ring value={completed / sessions.length} size={43} />
            <View
              style={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T size={11} weight="600">
                {completed}/{sessions.length}
              </T>
            </View>
          </View>
          <View>
            <T size={13} weight="600">
              {completed === sessions.length
                ? 'You showed up for yourself.'
                : 'Every little bit counts.'}
            </T>
            <T size={11} color={C.muted} style={{ marginTop: 3 }}>
              {completed} of {sessions.length} sessions completed
            </T>
          </View>
        </Row>
      )}
      {assessments.length > 0 && <Section title="A moment to check in" />}
      {assessments.map((a) => {
        const done = data?.responses.some((r) => r.assessmentId === a.id && r.date === date);
        return (
          <Pressable
            key={a.id}
            disabled={date > today}
            onPress={() => router.push(`/assessment/${a.id}?date=${date}`)}
          >
            <Card style={{ backgroundColor: C.sand, borderColor: C.sand, marginBottom: 12 }}>
              <Row>
                <Icon name={done ? 'check-circle' : 'heart'} size={22} />
                <View style={{ flex: 1, marginLeft: 4 }}>
                  <T weight="600" size={14}>
                    {done ? 'Check-in recorded' : a.name}
                  </T>
                  <T size={12} color={C.muted} style={{ marginTop: 4 }}>
                    {done
                      ? 'Thank you for noticing how you feel.'
                      : 'How is your body feeling today?'}
                  </T>
                </View>
                <Icon name="arrow-up-right" size={18} />
              </Row>
            </Card>
          </Pressable>
        );
      })}
      <T serif size={15} color={C.muted} style={{ textAlign: 'center', marginTop: 28 }}>
        Progress has its own pace.
      </T>
    </Screen>
  );
}
