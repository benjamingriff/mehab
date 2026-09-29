import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { DateTime } from 'luxon';
import {
  dayInZone,
  validateAnswers,
  type Assessment as AssessmentT,
  type AssessmentResponse,
} from '@rehab/core';
import { useStore } from '../../src/store';
import { Button, C, Card, Empty, Icon, Row, Screen, T, Tag, TopBar, haptic, s } from '../../src/ui';

type Field = AssessmentT['fields'][number];
type Answers = AssessmentResponse['answers'];

export default function Assessment() {
  const {
    id,
    date = dayInZone(),
    sessionId,
  } = useLocalSearchParams<{ id: string; date?: string; sessionId?: string }>();
  const store = useStore();
  const assessment = store.data?.assessments.find((a) => a.id === id);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const answer = (key: string, value: Answers[string]) => {
    haptic.tap();
    setAnswers((old) => ({ ...old, [key]: value }));
  };
  if (!assessment)
    return (
      <Screen>
        <TopBar icon="x" label="Close" />
        <Empty
          icon="alert-circle"
          title="Check-in not available"
          body="Refresh your plan to load this check-in."
        />
      </Screen>
    );
  const label = DateTime.fromISO(date).toFormat('cccc d LLLL');
  if (saved)
    return (
      <Screen
        refresh={false}
        footer={
          <View style={{ gap: 10 }}>
            <Button title="See progress" onPress={() => router.dismissTo('/progress')} />
            <Button title="Back to today" kind="secondary" onPress={() => router.dismissTo('/')} />
          </View>
        }
      >
        <View style={{ alignItems: 'center', paddingTop: 72, gap: 14 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: C.good,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check" size={34} color="#FFF" />
          </View>
          <T v="title" align="center">
            Check-in saved
          </T>
          <T v="callout" color={C.muted} align="center">
            {assessment.name} · {label}
          </T>
        </View>
        <Card style={{ marginTop: 32, gap: 12 }}>
          {assessment.fields
            .filter((f) => answers[f.id] !== undefined && answers[f.id] !== '')
            .map((f) => (
              <Row key={f.id} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <T v="callout" color={C.muted} style={{ flex: 1 }}>
                  {f.label}
                </T>
                <T v="strong" align="right" style={{ flex: 1 }}>
                  {format(answers[f.id])}
                  {f.type === 'numericScale' ? (
                    <T v="callout" color={C.muted}>{` / ${f.max}`}</T>
                  ) : null}
                </T>
              </Row>
            ))}
        </Card>
      </Screen>
    );

  const required = assessment.fields.filter((f) => f.required);
  const answered = required.filter((f) => answers[f.id] !== undefined).length;
  return (
    <Screen
      refresh={false}
      footer={
        <View style={{ gap: 8 }}>
          {!!error && (
            <T v="caption" color={C.bad} align="center">
              {error}
            </T>
          )}
          <Button
            title={busy ? 'Saving…' : 'Save check-in'}
            icon="check"
            disabled={busy}
            onPress={() => {
              const e = validateAnswers(assessment, answers);
              if (e) {
                setError(e);
                return;
              }
              setBusy(true);
              setError('');
              store
                .respond({
                  assessmentId: assessment.id,
                  assessmentVersion: assessment.version,
                  date,
                  sessionId,
                  answers,
                })
                .then(() => {
                  haptic.success();
                  setSaved(true);
                })
                .catch(() => setError('Couldn’t save on this device. Try again.'))
                .finally(() => setBusy(false));
            }}
          />
        </View>
      }
    >
      <TopBar
        icon="x"
        label="Close"
        right={
          required.length > 0 ? (
            <T v="caption" color={C.muted} style={{ fontVariant: ['tabular-nums'] }}>
              {answered} of {required.length} required
            </T>
          ) : undefined
        }
      />
      <T v="overline" color={C.muted}>
        {label}
      </T>
      <T v="display" style={{ marginTop: 4 }} accessibilityRole="header">
        {assessment.name}
      </T>
      <View style={{ gap: 10, marginTop: 24 }}>
        {assessment.fields.map((f) => (
          <Card key={f.id} style={{ gap: 14 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <T v="headline" style={{ flex: 1 }}>
                {f.label}
              </T>
              {!f.required && <Tag>Optional</Tag>}
              {f.type === 'numericScale' && (
                <T v="stat" size={26} style={{ lineHeight: 26 }}>
                  {typeof answers[f.id] === 'number' ? String(answers[f.id]) : ''}
                  <T v="strong" size={14} color={C.muted}>
                    {typeof answers[f.id] === 'number' ? ` / ${f.max}` : `Not set`}
                  </T>
                </T>
              )}
            </Row>
            <FieldInput field={f} value={answers[f.id]} onChange={(v) => answer(f.id, v)} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

function format(v: Answers[string] | undefined) {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v ?? '');
}

function FieldInput({
  field: f,
  value,
  onChange,
}: {
  field: Field;
  value: Answers[string] | undefined;
  onChange: (v: Answers[string]) => void;
}) {
  if (f.type === 'numericScale') {
    const steps = Math.round((f.max - f.min) / f.step);
    const values = Array.from(
      { length: steps + 1 },
      (_, i) => Math.round((f.min + i * f.step) * 10000) / 10000,
    );
    const current = typeof value === 'number' ? value : undefined;
    return (
      <View style={{ gap: 12 }}>
        {steps <= 10 ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {values.map((n) => {
              const on = current === n;
              const below = current !== undefined && n < current;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityLabel={`${f.label} ${n}`}
                  accessibilityState={{ checked: on }}
                  onPress={() => onChange(n)}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? C.ink : below ? '#C9CCC6' : C.fill,
                  }}
                >
                  <T
                    v="caption"
                    size={14}
                    weight="700"
                    color={on ? '#FFF' : C.ink2}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {n}
                  </T>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <>
            <Slider
              accessibilityLabel={f.label}
              minimumValue={f.min}
              maximumValue={f.max}
              step={f.step}
              value={current ?? f.min}
              onValueChange={(v) => onChange(v)}
              minimumTrackTintColor={C.ink}
              maximumTrackTintColor={C.line}
              thumbTintColor={C.ink}
            />
            {current === undefined && (
              <Button
                kind="secondary"
                small
                title={`Select ${f.min}`}
                onPress={() => onChange(f.min)}
              />
            )}
          </>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="caption" color={C.muted}>
            {f.min} · lowest
          </T>
          <T v="caption" color={C.muted}>
            highest · {f.max}
          </T>
        </Row>
      </View>
    );
  }
  if (f.type === 'text')
    return (
      <TextInput
        accessibilityLabel={f.label}
        multiline
        value={String(value ?? '')}
        onChangeText={(v) => onChange(v)}
        style={[
          s.input,
          { minHeight: 100, textAlignVertical: 'top', backgroundColor: C.bg, borderColor: C.bg },
        ]}
        placeholder="Add a note"
        placeholderTextColor={C.faint}
        maxLength={5000}
      />
    );
  const options = f.type === 'boolean' ? ['Yes', 'No'] : f.options;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => {
        const v = f.type === 'boolean' ? option === 'Yes' : option;
        const on =
          f.type === 'multiChoice' ? Array.isArray(value) && value.includes(option) : value === v;
        return (
          <Pressable
            key={option}
            accessibilityRole={f.type === 'multiChoice' ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (f.type === 'multiChoice') {
                const old = Array.isArray(value) ? value : [];
                onChange(on ? old.filter((x) => x !== option) : [...old, option]);
              } else onChange(v);
            }}
            style={{
              flexGrow: 1,
              minWidth: '22%',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              backgroundColor: on ? C.ink : C.fill,
              borderRadius: 12,
              paddingHorizontal: 14,
              minHeight: 46,
            }}
          >
            {on && f.type === 'multiChoice' && <Icon name="check" size={14} color="#FFF" />}
            <T v="strong" size={14} color={on ? '#FFF' : C.ink}>
              {option}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
