import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DateTime } from 'luxon';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { addDays, adherence, dayInZone, programmeDay, type Session } from '@rehab/core';
import { useStore } from '../../src/store';
import { currentProgrammes } from '../../src/helpers';
import {
  C,
  Card,
  Empty,
  Header,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Stat,
  T,
  Tag,
  haptic,
} from '../../src/ui';

type Period = 7 | 30 | 0;
type Point = { date: string; value: number };

export default function Progress() {
  const { data } = useStore();
  const [period, setPeriod] = useState<Period>(7);
  const [selected, setSelected] = useState<string>();
  const programmes = currentProgrammes(data);
  const p = programmes.find((x) => x.id === selected) ?? programmes[0];
  const today = dayInZone(p?.timezone);
  const from = !p
    ? today
    : period === 0
      ? p.startDate < today
        ? p.startDate
        : today
      : addDays(today, -period + 1);
  const due =
    data?.sessions.filter(
      (x) =>
        x.programmeId === p?.id &&
        (x.status !== 'pending' || new Date(x.scheduledAt).getTime() <= Date.now()),
    ) ?? [];
  const recent = due.filter((x) => x.date >= from && x.date <= today);
  const stats = adherence(recent);
  const overall = adherence(due);
  const responses =
    data?.responses.filter(
      (r) => r.assessment.programmeId === p?.id && r.date >= from && r.date <= today,
    ) ?? [];

  const series = new Map<
    string,
    { label: string; min: number; max: number; points: Map<string, { value: number; at: string }> }
  >();
  for (const r of responses)
    for (const f of r.assessment.fields) {
      if (f.type !== 'numericScale' || typeof r.answers[f.id] !== 'number') continue;
      const key = `${r.assessmentId}:${f.id}:${f.min}:${f.max}`;
      let s = series.get(key);
      if (!s) series.set(key, (s = { label: f.label, min: f.min, max: f.max, points: new Map() }));
      const old = s.points.get(r.date);
      if (!old || r.occurredAt > old.at)
        s.points.set(r.date, { value: r.answers[f.id] as number, at: r.occurredAt });
    }

  return (
    <Screen>
      <Header title="Progress" />
      {!p ? (
        <Empty
          icon="bar-chart-2"
          title="Nothing to show yet"
          body="Completed sessions and check-ins appear here."
        />
      ) : (
        <>
          {programmes.length > 1 && (
            <View style={{ marginBottom: 10 }}>
              <Segmented
                value={p.id}
                options={programmes.map((x) => ({ value: x.id, label: x.name }))}
                onChange={setSelected}
              />
            </View>
          )}
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
              { value: 0, label: 'Programme' },
            ]}
          />

          <Card style={{ marginTop: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Stat
                value={stats.total ? `${stats.percent}%` : '–'}
                label="Sessions completed"
                size={44}
              />
              <View style={{ alignItems: 'flex-end', gap: 4, paddingTop: 6 }}>
                <T v="strong" style={{ fontVariant: ['tabular-nums'] }}>
                  {stats.completed} of {stats.total}
                </T>
                <T v="caption" color={C.muted}>
                  {stats.skipped} skipped
                </T>
              </View>
            </Row>
            <DailyBars sessions={recent} from={from} to={today} />
          </Card>
          <T v="caption" color={C.muted} style={{ marginTop: 8, paddingHorizontal: 4 }}>
            Counts sessions due so far. Skipped sessions count as due.
          </T>

          <Row gap={10} style={{ marginTop: 12 }}>
            <Card style={{ flex: 1 }}>
              <Stat
                value={Math.max(0, Math.min(p.durationWeeks * 7, programmeDay(p, today)))}
                unit={`/ ${p.durationWeeks * 7}`}
                label="Programme day"
                size={26}
              />
            </Card>
            <Card style={{ flex: 1 }}>
              <Stat
                value={overall.total ? `${overall.percent}%` : '–'}
                label={`All time · ${overall.completed} done`}
                size={26}
              />
            </Card>
          </Row>

          <SectionHeader title="Symptoms" />
          {series.size === 0 ? (
            <Empty
              icon="activity"
              title="No check-ins in this period"
              body="Scores appear after a check-in. Days without a check-in are left blank."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {[...series].map(([key, s]) => (
                <SymptomCard
                  key={key}
                  label={s.label}
                  min={s.min}
                  max={s.max}
                  from={from}
                  to={today}
                  points={[...s.points]
                    .map(([date, x]) => ({ date, value: x.value }))
                    .sort((a, b) => a.date.localeCompare(b.date))}
                />
              ))}
            </View>
          )}

          <SectionHeader title="Check-in history" aside={`${responses.length}`} />
          {responses.length === 0 ? (
            <T v="callout" color={C.muted}>
              No check-ins in this period.
            </T>
          ) : (
            <View style={{ gap: 10 }}>
              {responses
                .slice()
                .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                .map((r) => {
                  const fields = r.assessment.fields.filter(
                    (f) => r.answers[f.id] !== undefined && r.answers[f.id] !== '',
                  );
                  const short = fields.filter((f) => f.type !== 'text');
                  const long = fields.filter((f) => f.type === 'text');
                  return (
                    <Card key={r.id} style={{ gap: 12 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="strong" weight="700">
                          {DateTime.fromISO(r.date).toFormat('ccc d LLL')}
                        </T>
                        <T v="caption" color={C.muted}>
                          {r.assessment.name}
                        </T>
                      </Row>
                      <Row gap={8} style={{ flexWrap: 'wrap' }}>
                        {short.map((f) => {
                          const v = r.answers[f.id];
                          return (
                            <View
                              key={f.id}
                              style={{
                                backgroundColor: C.bg,
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                              }}
                            >
                              <T v="caption" color={C.muted}>
                                {f.label}
                              </T>
                              <T v="strong" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
                                {Array.isArray(v)
                                  ? v.join(', ')
                                  : typeof v === 'boolean'
                                    ? v
                                      ? 'Yes'
                                      : 'No'
                                    : String(v)}
                              </T>
                            </View>
                          );
                        })}
                      </Row>
                      {long.map((f) => (
                        <View key={f.id} style={{ gap: 2 }}>
                          <T v="caption" color={C.muted}>
                            {f.label}
                          </T>
                          <T v="callout">{String(r.answers[f.id])}</T>
                        </View>
                      ))}
                    </Card>
                  );
                })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function DailyBars({ sessions, from, to }: { sessions: Session[]; from: string; to: string }) {
  const [active, setActive] = useState<string>();
  const n = Math.round(DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days) + 1;
  const days = Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i);
    const list = sessions.filter((x) => x.date === date);
    return {
      date,
      due: list.length,
      done: list.filter((x) => x.status === 'completed').length,
    };
  });
  const top = Math.max(1, ...days.map((d) => d.due));
  const H = 88;
  const pick = days.find((d) => d.date === active);
  const every = n <= 7 ? 1 : n <= 31 ? 7 : 14;
  return (
    <View style={{ marginTop: 18 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10, minHeight: 18 }}>
        {pick ? (
          <T v="caption" weight="600">
            {DateTime.fromISO(pick.date).toFormat('ccc d LLL')} · {pick.done} of {pick.due}{' '}
            completed
          </T>
        ) : (
          <Row gap={12}>
            <Row gap={5}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.ink }} />
              <T v="caption" color={C.ink2}>
                Completed
              </T>
            </Row>
            <Row gap={5}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.fill }} />
              <T v="caption" color={C.ink2}>
                Due
              </T>
            </Row>
          </Row>
        )}
      </Row>
      <View
        style={{
          height: H,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: n > 14 ? 2 : 6,
          borderBottomWidth: 1,
          borderBottomColor: C.line,
        }}
      >
        {days.map((d) => (
          <Pressable
            key={d.date}
            accessibilityLabel={`${d.date}: ${d.done} of ${d.due} completed`}
            onPress={() => {
              haptic.tap();
              setActive(active === d.date ? undefined : d.date);
            }}
            style={{ flex: 1, height: H, justifyContent: 'flex-end', alignItems: 'center' }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: 24,
                height: d.due ? Math.max(4, (d.due / top) * H) : 2,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                backgroundColor: active === d.date ? '#D9DBD5' : C.fill,
                justifyContent: 'flex-end',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: d.due ? `${(d.done / d.due) * 100}%` : 0,
                  backgroundColor: C.ink,
                  borderTopLeftRadius: d.done === d.due ? 4 : 0,
                  borderTopRightRadius: d.done === d.due ? 4 : 0,
                }}
              />
            </View>
          </Pressable>
        ))}
      </View>
      <Row gap={n > 14 ? 2 : 6} style={{ marginTop: 6 }}>
        {days.map((d, i) => (
          <View key={d.date} style={{ flex: 1, alignItems: n <= 7 ? 'center' : 'flex-start' }}>
            {(i % every === 0 || n <= 7) && (
              <T
                v="caption"
                size={11}
                color={C.muted}
                numberOfLines={1}
                style={{ width: n <= 7 ? undefined : 40 }}
              >
                {n <= 7
                  ? DateTime.fromISO(d.date).toFormat('ccc').slice(0, 1)
                  : DateTime.fromISO(d.date).toFormat('d LLL')}
              </T>
            )}
          </View>
        ))}
      </Row>
    </View>
  );
}

function SymptomCard({
  label,
  min,
  max,
  from,
  to,
  points,
}: {
  label: string;
  min: number;
  max: number;
  from: string;
  to: string;
  points: Point[];
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string>();
  const last = points.at(-1)!;
  const shown = points.find((x) => x.date === active) ?? last;
  const firstPoint = points[0];
  const change = last.value - firstPoint.value;
  const H = 120;
  const padL = 4;
  const padR = 26;
  const span = Math.max(1, DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days);
  const x = (d: string) =>
    padL +
    (DateTime.fromISO(d).diff(DateTime.fromISO(from), 'days').days / span) * (width - padL - padR);
  const y = (v: number) => 8 + (1 - (v - min) / (max - min)) * (H - 16);
  const line = points.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.date)},${y(pt.value)}`).join(' ');
  const area =
    points.length > 1
      ? `${line} L${x(last.date)},${y(min)} L${x(firstPoint.date)},${y(min)} Z`
      : '';
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 2 }}>
          <T v="strong" weight="700">
            {label}
          </T>
          <T v="caption" color={C.muted}>
            {shown === last && !active ? 'Latest' : 'Selected'} ·{' '}
            {DateTime.fromISO(shown.date).toFormat('ccc d LLL')}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <T v="stat" size={30}>
            {shown.value}
            <T v="strong" size={14} color={C.muted}>{` / ${max}`}</T>
          </T>
        </View>
      </Row>
      {points.length > 1 && change !== 0 && (
        <Row style={{ marginTop: 6 }}>
          <Tag>
            {change > 0 ? 'Up' : 'Down'} {Math.abs(change)} since{' '}
            {DateTime.fromISO(firstPoint.date).toFormat('d LLL')}
          </Tag>
        </Row>
      )}
      <Pressable
        accessibilityLabel={`${label}: ${points.map((pt) => `${pt.date} ${pt.value}`).join(', ')}`}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          const px = e.nativeEvent.locationX;
          const near = points.reduce((a, b) =>
            Math.abs(x(b.date) - px) < Math.abs(x(a.date) - px) ? b : a,
          );
          haptic.tap();
          setActive(near.date === active ? undefined : near.date);
        }}
        style={{ marginTop: 14, height: H }}
      >
        {width > 0 && (
          <Svg width={width} height={H}>
            {[min, (min + max) / 2, max].map((v) => (
              <Line
                key={v}
                x1={padL}
                x2={width - padR}
                y1={y(v)}
                y2={y(v)}
                stroke={C.line}
                strokeWidth={1}
              />
            ))}
            {area ? <Path d={area} fill={C.accent} fillOpacity={0.1} /> : null}
            <Path
              d={line}
              fill="none"
              stroke={C.accent}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {active && (
              <Line
                x1={x(shown.date)}
                x2={x(shown.date)}
                y1={4}
                y2={H - 4}
                stroke={C.ink}
                strokeWidth={1}
              />
            )}
            {points.map((pt) => (
              <Circle
                key={pt.date}
                cx={x(pt.date)}
                cy={y(pt.value)}
                r={pt.date === shown.date ? 6 : 4}
                fill={pt.date === shown.date ? C.ink : C.accent}
                stroke={C.surface}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
        {width > 0 &&
          [min, (min + max) / 2, max].map((v) => (
            <T
              key={v}
              v="caption"
              size={11}
              color={C.muted}
              style={{
                position: 'absolute',
                right: 0,
                top: y(v) - 8,
                fontVariant: ['tabular-nums'],
              }}
            >
              {v}
            </T>
          ))}
      </Pressable>
      <Row style={{ justifyContent: 'space-between', marginTop: 6, paddingRight: padR }}>
        <T v="caption" size={11} color={C.muted}>
          {DateTime.fromISO(from).toFormat('d LLL')}
        </T>
        <T v="caption" size={11} color={C.muted}>
          {DateTime.fromISO(to).toFormat('d LLL')}
        </T>
      </Row>
    </Card>
  );
}
