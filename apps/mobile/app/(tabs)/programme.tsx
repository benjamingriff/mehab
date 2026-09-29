import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DateTime } from 'luxon';
import {
  addDays,
  dayInZone,
  programmeDay,
  type Programme,
  type SessionTemplate,
} from '@rehab/core';
import { useStore } from '../../src/store';
import {
  WEEKDAYS,
  currentProgrammes,
  dose,
  sessionKind,
  shortTime,
  structure,
} from '../../src/helpers';
import {
  C,
  Card,
  Divider,
  Empty,
  Header,
  Icon,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Stat,
  StructureBar,
  T,
  Tag,
  haptic,
} from '../../src/ui';

export default function Plan() {
  const { data } = useStore();
  const all = currentProgrammes(data);
  const [selected, setSelected] = useState<string>();
  const p = all.find((x) => x.id === selected) ?? all[0];
  return (
    <Screen>
      <Header title="Plan" />
      {!p ? (
        <Empty
          icon="layers"
          title="No programme yet"
          body="Programmes added to your account appear here."
        />
      ) : (
        <>
          {all.length > 1 && (
            <View style={{ marginBottom: 12 }}>
              <Segmented
                value={p.id}
                options={all.map((x) => ({ value: x.id, label: x.name }))}
                onChange={setSelected}
              />
            </View>
          )}
          <Overview programme={p} />
          {!!p.description && (
            <T v="callout" color={C.ink2} style={{ marginTop: 16, paddingHorizontal: 4 }}>
              {p.description}
            </T>
          )}
          <Phases programme={p} />
          <SectionHeader title="Weekly sessions" aside={`${p.sessions.length} sessions`} />
          <View style={{ gap: 10 }}>
            {p.sessions
              .slice()
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((t) => (
                <Template key={t.id} template={t} />
              ))}
          </View>
          {data?.programmes.some(
            (v) => v.id === p.id && v.effectiveDate > dayInZone(p.timezone),
          ) && (
            <Card
              style={{
                marginTop: 16,
                backgroundColor: C.accentSoft,
                flexDirection: 'row',
                gap: 10,
              }}
            >
              <Icon name="calendar" size={17} color={C.accent} />
              <T v="callout" style={{ flex: 1 }}>
                An updated programme is scheduled and will appear here on its start date.
              </T>
            </Card>
          )}
          <T v="caption" color={C.muted} align="center" style={{ marginTop: 24 }}>
            Version {p.version} · {p.timezone}
          </T>
          <T v="caption" color={C.muted} align="center" style={{ marginTop: 2 }}>
            Recorded sessions keep the prescription they were done with.
          </T>
        </>
      )}
    </Screen>
  );
}

function Overview({ programme: p }: { programme: Programme }) {
  const total = p.durationWeeks * 7;
  const day = programmeDay(p, dayInZone(p.timezone));
  const week = Math.min(p.durationWeeks, Math.max(0, Math.ceil(day / 7)));
  const end = addDays(p.startDate, total - 1);
  const phaseIndex = p.phases.findIndex((ph) => week >= ph.startWeek && week <= ph.endWeek);
  const phase = p.phases[phaseIndex];
  return (
    <View style={{ backgroundColor: C.dark, borderRadius: 24, padding: 20 }}>
      <T v="overline" color={C.onDarkMuted}>
        {p.durationWeeks}-week programme
      </T>
      <T v="title" color="#FFF" style={{ marginTop: 6 }}>
        {p.name}
      </T>
      <T v="caption" color={C.onDarkMuted} style={{ marginTop: 4 }}>
        {DateTime.fromISO(p.startDate).toFormat('d LLL')} –{' '}
        {DateTime.fromISO(end).toFormat('d LLL yyyy')}
      </T>
      <Row gap={28} style={{ marginTop: 20 }}>
        <Stat
          value={day < 1 ? '–' : Math.min(week, p.durationWeeks)}
          unit={`/ ${p.durationWeeks}`}
          label="Week"
          color="#FFF"
          sub={C.onDarkMuted}
        />
        <Stat
          value={Math.max(0, Math.min(total, day))}
          unit={`/ ${total}`}
          label="Day"
          color="#FFF"
          sub={C.onDarkMuted}
        />
      </Row>
      <Row gap={3} style={{ marginTop: 20 }}>
        {(p.phases.length
          ? p.phases.map((ph) => ({ from: (ph.startWeek - 1) * 7, to: ph.endWeek * 7 }))
          : [{ from: 0, to: total }]
        ).map((seg, i) => {
          const fill = Math.max(0, Math.min(1, (day - seg.from) / (seg.to - seg.from)));
          return (
            <View
              key={i}
              style={{
                flex: seg.to - seg.from,
                height: 8,
                borderRadius: 4,
                backgroundColor: C.dark2,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: `${fill * 100}%`, height: 8, backgroundColor: C.volt }} />
            </View>
          );
        })}
      </Row>
      {phase && (
        <T v="caption" color={C.onDarkMuted} style={{ marginTop: 10 }}>
          {`Phase ${phaseIndex + 1} of ${p.phases.length}: ${phase.name}`}
        </T>
      )}
    </View>
  );
}

function Phases({ programme: p }: { programme: Programme }) {
  if (!p.phases.length) return null;
  const week = Math.ceil(programmeDay(p, dayInZone(p.timezone)) / 7);
  return (
    <>
      <SectionHeader title="Phases" />
      <Card style={{ paddingVertical: 6 }}>
        {p.phases.map((phase, i) => {
          const current = week >= phase.startWeek && week <= phase.endWeek;
          const done = week > phase.endWeek;
          const last = i === p.phases.length - 1;
          return (
            <Row key={phase.id} gap={14} style={{ alignItems: 'stretch' }}>
              <View style={{ alignItems: 'center', width: 28 }}>
                <View
                  style={{ width: 2, height: 14, backgroundColor: i ? C.line : 'transparent' }}
                />
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? C.good : current ? C.ink : C.surface,
                    borderWidth: done || current ? 0 : 2,
                    borderColor: C.line,
                  }}
                >
                  {done ? (
                    <Icon name="check" size={14} color="#FFF" />
                  ) : (
                    <T v="caption" weight="700" color={current ? '#FFF' : C.muted}>
                      {i + 1}
                    </T>
                  )}
                </View>
                <View
                  style={{ width: 2, flex: 1, backgroundColor: last ? 'transparent' : C.line }}
                />
              </View>
              <View style={{ flex: 1, paddingVertical: 14, gap: 2 }}>
                <T v="strong" size={16} weight="700" color={done ? C.ink2 : C.ink}>
                  {phase.name}
                </T>
                <T v="caption" color={C.muted}>
                  Weeks {phase.startWeek}–{phase.endWeek}
                </T>
              </View>
              {current && (
                <View style={{ justifyContent: 'center' }}>
                  <Tag color={C.accent} bg={C.accentSoft}>
                    Current
                  </Tag>
                </View>
              )}
            </Row>
          );
        })}
      </Card>
    </>
  );
}

function Template({ template: t }: { template: SessionTemplate }) {
  const [open, setOpen] = useState(false);
  const kind = sessionKind(t.prescriptions);
  return (
    <Card style={{ padding: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic.tap();
          setOpen(!open);
        }}
        style={{ padding: 16, gap: 12 }}
      >
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="caption" color={C.muted} style={{ fontVariant: ['tabular-nums'] }}>
              {shortTime(t.time)} · {kind.label}
            </T>
            <T v="strong" size={17} weight="700">
              {t.name}
            </T>
            <T v="caption" color={C.muted}>
              {t.prescriptions.length} exercises · {t.estimatedMinutes} min
            </T>
          </View>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={C.ink2} />
        </Row>
        <StructureBar segments={structure(t.prescriptions)} height={6} />
        <Row gap={4}>
          {WEEKDAYS.map((d, i) => {
            const on = t.weekdays.includes(i + 1);
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 26,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? C.fill : 'transparent',
                  borderWidth: on ? 0 : 1,
                  borderColor: C.line,
                }}
              >
                <T v="caption" size={11} weight="700" color={on ? C.ink : C.faint}>
                  {d}
                </T>
              </View>
            );
          })}
        </Row>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          {t.prescriptions.map((pr, i) => {
            const { main, details } = dose(pr);
            return (
              <View key={i}>
                <Divider />
                <Row style={{ paddingVertical: 12, alignItems: 'flex-start' }} gap={12}>
                  <T
                    v="caption"
                    weight="700"
                    color={C.faint}
                    style={{ width: 20, marginTop: 2, fontVariant: ['tabular-nums'] }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </T>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="strong">{pr.exercise.name}</T>
                    <T v="caption" color={C.muted}>
                      {[...details, pr.exercise.equipment].filter(Boolean).join(' · ') ||
                        pr.exercise.description}
                    </T>
                  </View>
                  <T v="strong" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
                    {main}
                  </T>
                </Row>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
