import React, { useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import { router, useLocalSearchParams } from 'expo-router';
import { dayInZone, validateAnswers, type AssessmentResponse } from '@rehab/core';
import { useStore } from '../../src/store';
import {
  Back,
  Button,
  C,
  Card,
  Empty,
  Icon,
  Label,
  Row,
  Screen,
  Section,
  T,
  s,
} from '../../src/ui';
export default function Assessment() {
  const {
    id,
    date = dayInZone(),
    sessionId,
  } = useLocalSearchParams<{ id: string; date?: string; sessionId?: string }>();
  const store = useStore();
  const assessment = store.data?.assessments.find((a) => a.id === id);
  const [answers, setAnswers] = useState<AssessmentResponse['answers']>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const answer = (id: string, value: any) => setAnswers((old) => ({ ...old, [id]: value }));
  if (!assessment)
    return (
      <Screen>
        <Back />
        <Empty title="Check-in not available" body="Refresh your plan to load this assessment." />
      </Screen>
    );
  if (saved)
    return (
      <Screen>
        <Back />
        <View style={{ alignItems: 'center', paddingVertical: 65, gap: 18 }}>
          <View style={{ backgroundColor: C.pale, borderRadius: 40, padding: 22 }}>
            <Icon name="check" size={36} />
          </View>
          <T serif size={35}>
            A moment, noted.
          </T>
          <T color={C.muted} style={{ textAlign: 'center' }}>
            Your check-in is saved. Over time, these small observations help you see the bigger
            picture.
          </T>
        </View>
        <Button title="See my progress" onPress={() => router.replace('/progress')} />
        <View style={{ height: 12 }} />
        <Button title="Back to today" secondary onPress={() => router.replace('/')} />
      </Screen>
    );
  return (
    <Screen refresh={false}>
      <Back />
      <Label>{date}</Label>
      <T serif size={36} style={{ marginTop: 10, letterSpacing: -1 }}>
        {assessment.name}
      </T>
      <T color={C.muted} style={{ marginTop: 12, marginBottom: 28 }}>
        Take a breath. Notice how you feel.
      </T>
      <View style={{ gap: 20 }}>
        {assessment.fields.map((f) => (
          <Card key={f.id} style={{ gap: 18 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={17} weight="600" style={{ flex: 1 }}>
                {f.label}
              </T>
              <T size={10} color={C.muted}>
                {f.required ? 'REQUIRED' : 'OPTIONAL'}
              </T>
            </Row>
            {f.type === 'numericScale' ? (
              <>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T serif size={38}>
                    {answers[f.id] === undefined ? '—' : String(answers[f.id])}
                    <T size={16} color={C.muted}>
                      {' '}
                      / {f.max}
                    </T>
                  </T>
                  <Icon name="activity" color={C.muted} />
                </Row>
                {(f.max - f.min) / f.step <= 10 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {Array.from(
                      { length: Math.round((f.max - f.min) / f.step) + 1 },
                      (_, i) => Math.round((f.min + i * f.step) * 10000) / 10000,
                    ).map((n) => (
                      <Pressable
                        key={n}
                        accessibilityRole="radio"
                        accessibilityLabel={`${f.label} ${n}`}
                        accessibilityState={{ checked: answers[f.id] === n }}
                        onPress={() => answer(f.id, n)}
                        style={{
                          minWidth: 42,
                          minHeight: 44,
                          borderRadius: 12,
                          backgroundColor: answers[f.id] === n ? C.green : C.bg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <T size={14} color={answers[f.id] === n ? 'white' : C.ink}>
                          {n}
                        </T>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <>
                    <Slider
                      accessibilityLabel={f.label}
                      minimumValue={f.min}
                      maximumValue={f.max}
                      step={f.step}
                      value={Number(answers[f.id] ?? f.min)}
                      onValueChange={(v) => answer(f.id, v)}
                      minimumTrackTintColor={C.green}
                      maximumTrackTintColor={C.line}
                      thumbTintColor={C.green}
                    />
                    <Button
                      secondary
                      small
                      title={`Select ${f.min}`}
                      onPress={() => answer(f.id, f.min)}
                    />
                  </>
                )}
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={11} color={C.muted}>
                    Minimum · {f.min}
                  </T>
                  <T size={11} color={C.muted}>
                    Maximum · {f.max}
                  </T>
                </Row>
              </>
            ) : f.type === 'text' ? (
              <TextInput
                accessibilityLabel={f.label}
                multiline
                value={String(answers[f.id] ?? '')}
                onChangeText={(v) => answer(f.id, v)}
                style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]}
                placeholder="A few words, if you like…"
                maxLength={5000}
              />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(f.type === 'boolean' ? ['Yes', 'No'] : f.options).map((option) => {
                  const value = f.type === 'boolean' ? option === 'Yes' : option;
                  const selected =
                    f.type === 'multiChoice'
                      ? Array.isArray(answers[f.id]) && (answers[f.id] as string[]).includes(option)
                      : answers[f.id] === value;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole={f.type === 'multiChoice' ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        if (f.type === 'multiChoice') {
                          const old = (answers[f.id] ?? []) as string[];
                          answer(
                            f.id,
                            selected ? old.filter((x) => x !== option) : [...old, option],
                          );
                        } else answer(f.id, value);
                      }}
                      style={{
                        backgroundColor: selected ? C.green : C.bg,
                        borderRadius: 12,
                        paddingHorizontal: 18,
                        paddingVertical: 14,
                      }}
                    >
                      <T size={13} color={selected ? 'white' : C.ink}>
                        {option}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        ))}
      </View>
      {!!error && (
        <T color={C.red} style={{ marginTop: 20 }}>
          {error}
        </T>
      )}
      <View style={{ marginTop: 28 }}>
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
              .then(() => setSaved(true))
              .catch(() => setError('Could not save on this device. Please try again.'))
              .finally(() => setBusy(false));
          }}
        />
      </View>
      <T color={C.muted} size={12} style={{ textAlign: 'center', marginTop: 16 }}>
        There’s no right answer. Just your experience today.
      </T>
    </Screen>
  );
}
