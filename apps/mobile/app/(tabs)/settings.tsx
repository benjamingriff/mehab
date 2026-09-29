import React, { useState } from 'react';
import { View, Switch, Platform, Pressable, TextInput } from 'react-native';
import { DateTime } from 'luxon';
import { router } from 'expo-router';
import { useStore } from '../../src/store';
import { askReminders, testReminder } from '../../src/notifications';
import { Button, C, Card, Icon, Label, Row, Screen, Section, T, s } from '../../src/ui';
export default function Settings() {
  const store = useStore();
  const [message, setMessage] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const [tokenEditor, setTokenEditor] = useState(false);
  const [replacementToken, setReplacementToken] = useState('');
  async function perform(fn: () => Promise<any>) {
    try {
      setMessage('');
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <Screen>
      <Label>MAKE IT YOURS</Label>
      <T serif size={37} style={{ marginTop: 9, letterSpacing: -1 }}>
        A little support.
      </T>
      <T color={C.muted} style={{ marginTop: 8, marginBottom: 10 }}>
        Your reminders. Your rhythm.
      </T>
      <Section title="Gentle reminders" />
      <Card style={{ gap: 18 }}>
        <Row>
          <View
            style={{
              width: 39,
              height: 39,
              borderRadius: 13,
              backgroundColor: C.pale,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bell" />
          </View>
          <View style={{ flex: 1 }}>
            <T size={15} weight="600">
              Session reminders
            </T>
            <T size={12} color={C.muted} style={{ marginTop: 4 }}>
              A nudge when it’s time for you.
            </T>
          </View>
          <Switch
            accessibilityLabel="Session reminders"
            value={store.reminders}
            disabled={!store.connection || Platform.OS === 'web'}
            trackColor={{ false: C.line, true: C.green }}
            onValueChange={(v) =>
              void perform(async () => {
                if (v) await askReminders();
                await store.setReminders(v);
              })
            }
          />
        </Row>
        <T size={12} color={C.muted} style={{ lineHeight: 19 }}>
          {Platform.OS === 'web'
            ? 'Open the iPhone app to enable local notifications.'
            : 'Reminders follow your programme’s timezone. Open the app regularly to keep the next reminders ready.'}
        </T>
        <Button
          title="Try a reminder in 10 seconds"
          secondary
          icon="bell"
          disabled={Platform.OS === 'web' || !store.connection}
          onPress={() =>
            void perform(async () => {
              await testReminder();
              setMessage('Test reminder scheduled. It will arrive in 10 seconds.');
            })
          }
        />
      </Card>
      {store.notificationError && (
        <T color={C.red} size={13} style={{ marginTop: 16 }}>
          {store.notificationError}
        </T>
      )}
      <Section title="Your account" />
      <Card style={{ gap: 18 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <T size={16} weight="600">
              {store.data?.user.name ?? 'Not connected'}
            </T>
            <T size={12} color={C.muted} style={{ marginTop: 5 }}>
              {store.connection?.url ?? 'Connect your server to get started.'}
            </T>
          </View>
          <Icon name="shield" size={21} />
        </Row>
        {store.connection ? (
          <>
            <View style={s.divider} />
            <Row>
              <Icon name={store.outbox.length ? 'upload-cloud' : 'check-circle'} size={19} />
              <View style={{ flex: 1 }}>
                <T size={14} weight="500">
                  {store.syncing
                    ? 'Syncing…'
                    : store.outbox.length
                      ? `${store.outbox.length} change${store.outbox.length === 1 ? '' : 's'} saved on this device`
                      : 'Everything is up to date'}
                </T>
                <T size={11} color={C.muted} style={{ marginTop: 5 }}>
                  {store.lastSync
                    ? `Last synced ${DateTime.fromISO(store.lastSync).toFormat('d LLL, h:mm a')}`
                    : 'Your changes sync when you’re connected.'}
                </T>
              </View>
            </Row>
            <Button
              title="Sync now"
              secondary
              disabled={store.syncing}
              icon="refresh-cw"
              onPress={() => void store.sync()}
            />
            <Button
              title="Replace access token"
              secondary
              small
              icon="key"
              onPress={() => setTokenEditor((v) => !v)}
            />
            {tokenEditor && (
              <View style={{ gap: 12 }}>
                <T size={12} color={C.muted}>
                  Paste a new token for this account. Your saved changes will be kept.
                </T>
                <TextInput
                  accessibilityLabel="Replacement token"
                  style={s.input}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={replacementToken}
                  onChangeText={setReplacementToken}
                  placeholder="New personal token"
                />
                <Button
                  title="Save new token"
                  disabled={!replacementToken || store.syncing}
                  onPress={() =>
                    void perform(async () => {
                      await store.replaceToken(replacementToken);
                      setReplacementToken('');
                      setTokenEditor(false);
                    })
                  }
                />
              </View>
            )}
            {store.outbox
              .filter((j) => j.error)
              .map((job) => (
                <View
                  key={job.id}
                  style={{ padding: 14, backgroundColor: C.sand, borderRadius: 12, gap: 12 }}
                >
                  <T size={12} color={C.red}>
                    {job.error}
                  </T>
                  <T size={12}>
                    This change is kept on your device. Retry sync, or remove it to use the server’s
                    record.
                  </T>
                  <Button
                    secondary
                    small
                    title="Remove this rejected change"
                    onPress={() => void perform(() => store.discardJob(job.id))}
                  />
                </View>
              ))}
          </>
        ) : (
          <Button title="Connect my account" onPress={() => router.push('/')} />
        )}
      </Card>
      <Section title="Made for your recovery" />
      <Card style={{ gap: 16 }}>
        <Row>
          <Icon name="wifi-off" size={18} />
          <T size={13} style={{ flex: 1 }}>
            Your saved plan works offline. Completions and check-ins stay on this device until they
            sync.
          </T>
        </Row>
        <Row>
          <Icon name="layers" size={18} />
          <T size={13} style={{ flex: 1 }}>
            Your programme is managed through your connected account. Past sessions keep their
            original prescriptions.
          </T>
        </Row>
      </Card>
      {!!message && (
        <T color={C.red} style={{ marginTop: 20 }}>
          {message}
        </T>
      )}
      {store.connection && (
        <View style={{ marginTop: 28 }}>
          {disconnecting ? (
            <View style={{ gap: 12 }}>
              <T size={13} color={C.muted}>
                Disconnect this device? Your synced history stays in your account.
              </T>
              <Button
                secondary
                title="Disconnect account"
                onPress={() =>
                  void perform(async () => {
                    await store.disconnect();
                    setDisconnecting(false);
                    router.replace('/');
                  })
                }
              />
              <Button secondary title="Keep me connected" onPress={() => setDisconnecting(false)} />
            </View>
          ) : (
            <Pressable
              onPress={() => setDisconnecting(true)}
              style={{ padding: 15, alignItems: 'center' }}
            >
              <T size={13} color={C.muted}>
                Disconnect this device
              </T>
            </Pressable>
          )}
        </View>
      )}
      <T size={11} color={C.muted} style={{ textAlign: 'center', marginTop: 30 }}>
        REHAB · VERSION 1.0 · PRIVATE TRIAL
      </T>
    </Screen>
  );
}
