import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { DateTime } from 'luxon';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { adherence, dayInZone, addDays, programmeDay } from '@rehab/core';
import { useStore } from '../../src/store';
import { currentProgrammes } from '../../src/helpers';
import { C, Card, Empty, Icon, Label, Pill, Row, Screen, Section, T, Ring } from '../../src/ui';
function Trend({
  points,
  min,
  max,
  from,
  to,
}: {
  points: { date: string; value: number }[];
  min: number;
  max: number;
  from: string;
  to: string;
}) {
  const span = DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days || 1;
  const x = (d: string) =>
    18 + (DateTime.fromISO(d).diff(DateTime.fromISO(from), 'days').days / span) * 270;
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 78;
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.date)} ${y(p.value)}`).join(' ');
  return (
    <Svg
      width="100%"
      height={140}
      viewBox="0 0 310 140"
      accessibilityLabel={points.map((p) => `${p.date}: ${p.value}`).join(', ')}
    >
      {[min, (min + max) / 2, max].map((v) => (
        <React.Fragment key={v}>
          <Line x1="18" x2="288" y1={y(v)} y2={y(v)} stroke={C.line} strokeDasharray="3 5" />
          <SvgText x="305" y={y(v) + 4} textAnchor="end" fill={C.muted} fontSize="9">
            {v}
          </SvgText>
        </React.Fragment>
      ))}
      <Path d={path} fill="none" stroke={C.green} strokeWidth="2" />
      {points.map((p) => (
        <Circle
          key={p.date}
          cx={x(p.date)}
          cy={y(p.value)}
          r="3.5"
          fill={C.green}
          stroke="white"
          strokeWidth="1.5"
        />
      ))}
      <SvgText x="18" y="128" fill={C.muted} fontSize="10">
        {DateTime.fromISO(from).toFormat('d LLL')}
      </SvgText>
      <SvgText x="288" y="128" textAnchor="end" fill={C.muted} fontSize="10">
        {DateTime.fromISO(to).toFormat('d LLL')}
      </SvgText>
    </Svg>
  );
}
export default function Progress() {
  const { data } = useStore();
  const [period, setPeriod] = useState<7 | 30>(7);
  const [selected, setSelected] = useState<string>();
  const programmes = currentProgrammes(data);
  const p = programmes.find((p) => p.id === selected) ?? programmes[0];
  const today = dayInZone(p?.timezone);
  const from = addDays(today, -period + 1);
  const all =
    data?.sessions.filter(
      (s) =>
        s.programmeId === p?.id &&
        (s.status !== 'pending' || new Date(s.scheduledAt).getTime() <= Date.now()),
    ) ?? [];
  const recent = all.filter((s) => s.date >= from && s.date <= today);
  const stats = adherence(recent);
  const overall = adherence(all);
  const responses =
    data?.responses.filter(
      (r) => r.assessment.programmeId === p?.id && r.date >= from && r.date <= today,
    ) ?? [];
  const numeric = new Map<
    string,
    {
      label: string;
      min: number;
      max: number;
      points: Map<string, { value: number; occurredAt: string }>;
    }
  >();
  for (const r of responses)
    for (const f of r.assessment.fields) {
      if (f.type !== 'numericScale' || typeof r.answers[f.id] !== 'number') continue;
      const key = `${r.assessmentId}:${f.id}:${f.min}:${f.max}`;
      let series = numeric.get(key);
      if (!series) {
        series = { label: f.label, min: f.min, max: f.max, points: new Map() };
        numeric.set(key, series);
      }
      const old = series.points.get(r.date);
      if (!old || r.occurredAt > old.occurredAt)
        series.points.set(r.date, { value: r.answers[f.id] as number, occurredAt: r.occurredAt });
    }
  return (
    <Screen>
      <Label>SMALL STEPS ADD UP</Label>
      <T serif size={37} style={{ marginTop: 9, letterSpacing: -1 }}>
        Your progress.
      </T>
      <T color={C.muted} style={{ marginTop: 8, marginBottom: 25 }}>
        See the care you’re putting in.
      </T>
      {!p ? (
        <Empty
          title="Your story is just beginning"
          body="Complete a session or check in to start seeing your progress here."
        />
      ) : (
        <>
          {programmes.length > 1 && (
            <Row style={{ flexWrap: 'wrap', marginBottom: 16 }}>
              {programmes.map((p) => (
                <Pressable key={p.id} onPress={() => setSelected(p.id)}>
                  <Pill>{p.name}</Pill>
                </Pressable>
              ))}
            </Row>
          )}
          <Row style={{ backgroundColor: C.line, padding: 4, borderRadius: 14, marginBottom: 22 }}>
            {([7, 30] as const).map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                onPress={() => setPeriod(n)}
                style={{
                  flex: 1,
                  padding: 12,
                  alignItems: 'center',
                  borderRadius: 11,
                  backgroundColor: period === n ? C.paper : 'transparent',
                }}
              >
                <T
                  size={13}
                  weight={period === n ? '600' : '400'}
                  color={period === n ? C.ink : C.muted}
                >
                  {n === 7 ? 'Past 7 days' : 'Past 30 days'}
                </T>
              </Pressable>
            ))}
          </Row>
          <Card style={{ padding: 24 }}>
            <Label>SHOWING UP</Label>
            <Row style={{ marginTop: 15, justifyContent: 'space-between' }}>
              <View>
                <T serif size={51}>
                  {stats.total ? `${stats.percent}%` : '—'}
                </T>
                <T color={C.muted} size={13}>
                  session adherence
                </T>
              </View>
              <View>
                <Ring value={stats.percent / 100} size={90} />
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={25} />
                </View>
              </View>
            </Row>
            <View style={{ height: 1, backgroundColor: C.line, marginVertical: 22 }} />
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T size={22} weight="600">
                  {stats.completed}
                  <T size={13} color={C.muted}>
                    {' '}
                    / {stats.total}
                  </T>
                </T>
                <T size={11} color={C.muted}>
                  sessions completed
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={22} weight="600">
                  {stats.skipped}
                </T>
                <T size={11} color={C.muted}>
                  sessions skipped
                </T>
              </View>
            </Row>
          </Card>
          <T size={11} color={C.muted} style={{ marginTop: 12, lineHeight: 17 }}>
            Based on sessions due so far. Skipped sessions count toward the total; upcoming sessions
            don’t.
          </T>
          <Section
            title="How you’ve been feeling"
            aside={<Icon name="activity" size={17} color={C.muted} />}
          />
          {numeric.size === 0 ? (
            <Empty
              title="Make space to notice"
              body="Your symptom trends will appear after your first check-in. No scores are assumed on days you don’t check in."
            />
          ) : (
            <View style={{ gap: 14 }}>
              {[...numeric].map(([key, series]) => {
                const points = [...series.points]
                  .map(([date, p]) => ({ date, value: p.value }))
                  .sort((a, b) => a.date.localeCompare(b.date));
                const last = points.at(-1)!;
                return (
                  <Card key={key}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 15 }}>
                      <View>
                        <T size={16} weight="600">
                          {series.label}
                        </T>
                        <T size={11} color={C.muted} style={{ marginTop: 4 }}>
                          Latest check-in · {DateTime.fromISO(last.date).toFormat('d LLL')}
                        </T>
                      </View>
                      <T serif size={29}>
                        {last.value}
                        <T size={12} color={C.muted}>
                          {' '}
                          / {series.max}
                        </T>
                      </T>
                    </Row>
                    <Trend
                      points={points}
                      min={series.min}
                      max={series.max}
                      from={from}
                      to={today}
                    />
                  </Card>
                );
              })}
            </View>
          )}
          <Section title="Along the way" />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ gap: 7 }}>
                <Label>PROGRAMME DAY</Label>
                <T serif size={29}>
                  {Math.max(0, Math.min(p.durationWeeks * 7, programmeDay(p, today)))}
                  <T size={13} color={C.muted}>
                    {' '}
                    / {p.durationWeeks * 7}
                  </T>
                </T>
              </View>
              <View style={{ gap: 7, alignItems: 'flex-end' }}>
                <Label>OVERALL ADHERENCE</Label>
                <T serif size={29}>
                  {overall.total ? `${overall.percent}%` : '—'}
                </T>
              </View>
            </Row>
            <T size={12} color={C.muted} style={{ marginTop: 16 }}>
              {p.phases.find((ph) => {
                const w = Math.ceil(programmeDay(p, today) / 7);
                return w >= ph.startWeek && w <= ph.endWeek;
              })?.name ?? p.name}{' '}
              · {overall.completed} sessions completed
            </T>
          </Card>
          <Section title="Check-in history" />
          {responses.length === 0 ? (
            <T color={C.muted} size={13}>
              Your saved check-ins will appear here.
            </T>
          ) : (
            responses
              .slice()
              .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
              .map((r) => (
                <Card key={r.id} style={{ marginBottom: 12, gap: 10 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T size={14} weight="600">
                      {r.assessment.name}
                    </T>
                    <T size={11} color={C.muted}>
                      {DateTime.fromISO(r.date).toFormat('d LLL')}
                    </T>
                  </Row>
                  {r.assessment.fields
                    .filter((f) => r.answers[f.id] !== undefined)
                    .map((f) => (
                      <Row key={f.id} style={{ alignItems: 'flex-start' }}>
                        <T size={12} color={C.muted} style={{ flex: 1 }}>
                          {f.label}
                        </T>
                        <T size={12} style={{ flex: 1, textAlign: 'right' }}>
                          {Array.isArray(r.answers[f.id])
                            ? (r.answers[f.id] as string[]).join(', ')
                            : typeof r.answers[f.id] === 'boolean'
                              ? r.answers[f.id]
                                ? 'Yes'
                                : 'No'
                              : String(r.answers[f.id])}
                        </T>
                      </Row>
                    ))}
                </Card>
              ))
          )}
        </>
      )}
    </Screen>
  );
}
