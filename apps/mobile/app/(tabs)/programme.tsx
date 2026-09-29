import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { DateTime } from 'luxon';
import { dayInZone, programmeDay, prescriptionLabel, addDays } from '@rehab/core';
import { useStore } from '../../src/store';
import { currentProgrammes, formatTime } from '../../src/helpers';
import {
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
  Botanical,
} from '../../src/ui';
export default function Programme() {
  const { data } = useStore();
  const all = currentProgrammes(data);
  const [selected, setSelected] = useState<string>();
  const p = all.find((p) => p.id === selected) ?? all[0];
  const [expanded, setExpanded] = useState<string>();
  return (
    <Screen>
      <Label>THE BIGGER PICTURE</Label>
      <T serif size={37} style={{ marginTop: 9, letterSpacing: -1 }}>
        Your programme.
      </T>
      <T color={C.muted} style={{ marginTop: 8, marginBottom: 27 }}>
        A steady path back to you.
      </T>
      {!p ? (
        <Empty
          title="Your plan starts here"
          body="Connect your account in Today. Programmes added to your account will appear here."
        />
      ) : (
        <>
          {all.length > 1 && (
            <Row style={{ flexWrap: 'wrap', marginBottom: 18 }}>
              {all.map((p) => (
                <Pressable key={p.id} onPress={() => setSelected(p.id)}>
                  <Pill bg={selected === p.id ? C.lime : C.pale}>{p.name}</Pill>
                </Pressable>
              ))}
            </Row>
          )}
          <Card
            style={{
              backgroundColor: C.pale,
              borderColor: C.pale,
              overflow: 'hidden',
              padding: 24,
            }}
          >
            <View style={{ position: 'absolute', right: -15, bottom: -35, opacity: 0.5 }}>
              <Botanical size={160} color={C.green} />
            </View>
            <Label>
              {p.durationWeeks} WEEKS · {p.timezone}
            </Label>
            <T serif size={30} style={{ marginTop: 14, maxWidth: '85%' }}>
              {p.name}
            </T>
            <T color={C.muted} size={13} style={{ marginTop: 12 }}>
              {DateTime.fromISO(p.startDate).toFormat('d LLL')} —{' '}
              {DateTime.fromISO(addDays(p.startDate, p.durationWeeks * 7 - 1)).toFormat(
                'd LLL yyyy',
              )}
            </T>
          </Card>
          {!!p.description && (
            <T size={14} color={C.muted} style={{ marginTop: 20, lineHeight: 23 }}>
              {p.description}
            </T>
          )}
          <Section title="One phase at a time" />
          <Card style={{ paddingVertical: 10 }}>
            {p.phases.map((phase, i) => {
              const week = Math.ceil(programmeDay(p, dayInZone(p.timezone)) / 7);
              const current = week >= phase.startWeek && week <= phase.endWeek;
              const done = week > phase.endWeek;
              return (
                <View
                  key={phase.id}
                  style={{
                    flexDirection: 'row',
                    gap: 16,
                    paddingVertical: 17,
                    borderBottomWidth: i < p.phases.length - 1 ? 1 : 0,
                    borderBottomColor: C.line,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: current ? C.green : done ? C.pale : C.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? (
                      <Icon name="check" size={16} />
                    ) : (
                      <T size={12} weight="600" color={current ? 'white' : C.muted}>
                        {i + 1}
                      </T>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <T size={15} weight="600">
                      {phase.name}
                    </T>
                    <T size={12} color={C.muted}>
                      Weeks {phase.startWeek}–{phase.endWeek}
                    </T>
                  </View>
                  {current && <Pill>Current</Pill>}
                </View>
              );
            })}
            {!p.phases.length && (
              <T color={C.muted} style={{ paddingVertical: 15 }}>
                Your programme has one continuous phase.
              </T>
            )}
          </Card>
          <Section title="Your regular sessions" />
          <View style={{ gap: 12 }}>
            {p.sessions.map((t) => (
              <Card key={t.id}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpanded(expanded === t.id ? undefined : t.id)}
                >
                  <Row>
                    <View style={{ flex: 1, gap: 6 }}>
                      <T size={16} weight="600">
                        {t.name}
                      </T>
                      <T size={12} color={C.muted}>
                        {t.weekdays.length === 7
                          ? 'Every day'
                          : t.weekdays
                              .map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1])
                              .join(', ')}{' '}
                        · {formatTime(t.time)}
                      </T>
                      <T size={12} color={C.muted}>
                        {t.estimatedMinutes} min · {t.prescriptions.length} exercises
                      </T>
                    </View>
                    <Icon name={expanded === t.id ? 'chevron-up' : 'chevron-down'} size={18} />
                  </Row>
                </Pressable>
                {expanded === t.id && (
                  <View style={{ marginTop: 20, gap: 18 }}>
                    {t.prescriptions.map((pr, i) => (
                      <View
                        key={i}
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: C.line,
                          paddingTop: 15,
                          gap: 6,
                        }}
                      >
                        <T size={14} weight="600">
                          {i + 1}. {pr.exercise.name}
                        </T>
                        <T size={13} color={C.green}>
                          {prescriptionLabel(pr)}
                        </T>
                        {pr.exercise.instructions.map((line, n) => (
                          <T key={n} size={12} color={C.muted}>
                            {line}
                          </T>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ))}
          </View>
          {data?.programmes.some(
            (v) => v.id === p.id && v.effectiveDate > dayInZone(p.timezone),
          ) && (
            <Card style={{ marginTop: 20, backgroundColor: C.sand }}>
              <T size={13}>
                An updated programme is scheduled. It will appear here on its effective date.
              </T>
            </Card>
          )}
          <T color={C.muted} size={11} style={{ marginTop: 25, textAlign: 'center' }}>
            Programme version {p.version} · Your recorded sessions keep their original plan.
          </T>
        </>
      )}
    </Screen>
  );
}
