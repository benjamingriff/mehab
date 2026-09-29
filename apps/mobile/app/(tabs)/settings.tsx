import React, { useState } from 'react';
import { Platform, Pressable, Switch, TextInput, View } from 'react-native';
import { DateTime } from 'luxon';
import { router } from 'expo-router';
import { useStore } from '../../src/store';
import { askReminders, testReminder } from '../../src/notifications';
import {
  Button,
  C,
  Card,
  Divider,
  Header,
  Icon,
  Row,
  Screen,
  T,
  haptic,
  s,
  type IconName,
} from '../../src/ui';

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <T v="overline" color={C.muted} style={{ marginBottom: 8, paddingHorizontal: 4 }}>
        {title}
      </T>
      <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>{children}</Card>
      {note && (
        <T v="caption" color={C.muted} style={{ marginTop: 8, paddingHorizontal: 4 }}>
          {note}
        </T>
      )}
    </View>
  );
}

function Item({
  icon,
  title,
  detail,
  right,
  onPress,
  label,
  disabled,
  color = C.ink,
  iconColor = color,
  tint = C.fill,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  label?: string;
  disabled?: boolean;
  color?: string;
  iconColor?: string;
  tint?: string;
}) {
  const body = (
    <Row gap={14} style={{ paddingVertical: 12, opacity: disabled ? 0.45 : 1 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={17} color={iconColor} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T v="strong" color={color}>
          {title}
        </T>
        {detail && (
          <T v="caption" color={C.muted}>
            {detail}
          </T>
        )}
      </View>
      {right ?? (onPress && <Icon name="chevron-right" size={18} color={C.faint} />)}
    </Row>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export default function Settings() {
  const store = useStore();
  const [message, setMessage] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const [tokenEditor, setTokenEditor] = useState(false);
  const [replacementToken, setReplacementToken] = useState('');
  const web = Platform.OS === 'web';
  async function perform(fn: () => Promise<unknown>) {
    try {
      setMessage('');
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const pending = store.outbox.length;
  const rejected = store.outbox.filter((j) => j.error);
  return (
    <Screen>
      <Header title="Settings" />

      {store.connection && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: C.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T v="headline" color="#FFF">
              {(store.data?.user.name ?? '?').slice(0, 1).toUpperCase()}
            </T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="headline">{store.data?.user.name ?? 'Connected'}</T>
            <T v="caption" color={C.muted} numberOfLines={1}>
              {store.connection.url}
            </T>
          </View>
        </Card>
      )}

      <Group
        title="Reminders"
        note={
          web
            ? 'Notifications are available in the iPhone app.'
            : 'Reminders use your programme’s timezone. Open the app regularly to keep upcoming reminders queued.'
        }
      >
        <Item
          icon="bell"
          title="Session reminders"
          detail="Notify me at each session time"
          right={
            <Switch
              accessibilityLabel="Session reminders"
              value={store.reminders}
              disabled={!store.connection || web}
              trackColor={{ false: C.line, true: C.ink }}
              onValueChange={(v) =>
                void perform(async () => {
                  if (v) await askReminders();
                  await store.setReminders(v);
                })
              }
            />
          }
        />
        <Divider style={{ marginLeft: 48 }} />
        <Item
          icon="send"
          title="Send a test reminder"
          detail="Arrives in 10 seconds"
          label="Try a reminder in 10 seconds"
          disabled={web || !store.connection}
          onPress={() =>
            void perform(async () => {
              await testReminder();
              setMessage('Test reminder scheduled for 10 seconds from now.');
            })
          }
        />
      </Group>
      {store.notificationError && (
        <T v="caption" color={C.bad} style={{ marginTop: 8, paddingHorizontal: 4 }}>
          {store.notificationError}
        </T>
      )}

      {store.connection ? (
        <>
          <Group
            title="Sync"
            note="Your plan is stored on this device and works offline. Changes sync when you’re connected."
          >
            <Item
              icon={store.syncing ? 'loader' : pending ? 'upload-cloud' : 'check-circle'}
              iconColor={pending ? C.warn : C.good}
              tint={pending ? C.warnSoft : C.goodSoft}
              title={
                store.syncing
                  ? 'Syncing…'
                  : pending
                    ? `${pending} change${pending === 1 ? '' : 's'} saved on this device`
                    : 'Everything is up to date'
              }
              detail={
                store.lastSync
                  ? `Last synced ${DateTime.fromISO(store.lastSync).toFormat('d LLL, HH:mm')}`
                  : 'Not synced yet'
              }
            />
            <View style={{ paddingBottom: 12 }}>
              <Button
                title="Sync now"
                kind="secondary"
                small
                icon="refresh-cw"
                disabled={store.syncing}
                onPress={() => void store.sync()}
              />
            </View>
            {rejected.map((job) => (
              <View
                key={job.id}
                style={{
                  padding: 14,
                  backgroundColor: C.badSoft,
                  borderRadius: 12,
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <Row gap={8} style={{ alignItems: 'flex-start' }}>
                  <Icon name="alert-circle" size={16} color={C.bad} />
                  <T v="callout" weight="600" color={C.bad} style={{ flex: 1 }}>
                    {job.error}
                  </T>
                </Row>
                <T v="caption" color={C.ink2}>
                  This change is kept on your device. Retry sync, or remove it to use the server’s
                  record.
                </T>
                <Button
                  kind="danger"
                  small
                  title="Remove this rejected change"
                  onPress={() => void perform(() => store.discardJob(job.id))}
                />
              </View>
            ))}
          </Group>

          <Group title="Account">
            <Item
              icon="key"
              title="Replace access token"
              detail="Keeps changes saved on this device"
              right={
                <Icon
                  name={tokenEditor ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={C.faint}
                />
              }
              onPress={() => setTokenEditor((v) => !v)}
            />
            {tokenEditor && (
              <View style={{ gap: 10, paddingBottom: 14 }}>
                <TextInput
                  accessibilityLabel="Replacement token"
                  style={[s.input, { backgroundColor: C.bg, borderColor: C.bg }]}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={replacementToken}
                  onChangeText={setReplacementToken}
                  placeholder="New personal token"
                  placeholderTextColor={C.faint}
                />
                <Button
                  title="Save new token"
                  small
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
            <Divider style={{ marginLeft: 48 }} />
            {disconnecting ? (
              <View style={{ gap: 10, paddingVertical: 14 }}>
                <T v="callout" color={C.ink2}>
                  Disconnect this device? Your synced history stays in your account.
                </T>
                <Row gap={8}>
                  <Button
                    kind="secondary"
                    small
                    title="Cancel"
                    label="Keep me connected"
                    onPress={() => setDisconnecting(false)}
                    wrap={{ flex: 1 }}
                  />
                  <Button
                    kind="danger"
                    small
                    title="Disconnect"
                    label="Disconnect account"
                    wrap={{ flex: 1 }}
                    onPress={() =>
                      void perform(async () => {
                        await store.disconnect();
                        setDisconnecting(false);
                        router.replace('/');
                      })
                    }
                  />
                </Row>
              </View>
            ) : (
              <Item
                icon="log-out"
                title="Disconnect this device"
                color={C.bad}
                tint={C.badSoft}
                right={<View />}
                onPress={() => setDisconnecting(true)}
              />
            )}
          </Group>
        </>
      ) : (
        <View style={{ marginTop: 24 }}>
          <Button title="Connect my account" onPress={() => router.push('/')} />
        </View>
      )}

      {!!message && (
        <T v="callout" color={C.ink2} style={{ marginTop: 16, paddingHorizontal: 4 }}>
          {message}
        </T>
      )}
      <T v="caption" color={C.faint} align="center" style={{ marginTop: 32 }}>
        Rehab 1.0
      </T>
    </Screen>
  );
}
