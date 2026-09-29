import React, { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { useStore } from './store';
import { Button, C, Logo, Row, Screen, T, s } from './ui';

export function Connect() {
  const store = useStore();
  const [url, setUrl] = useState(Platform.OS === 'web' ? 'http://localhost:3000' : '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = () => {
    setBusy(true);
    setError('');
    store
      .connect(url, token)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <Screen
      refresh={false}
      footer={
        <Button
          title={busy ? 'Connecting…' : 'Connect my account'}
          iconRight="arrow-right"
          disabled={busy || !url || !token}
          onPress={submit}
        />
      }
    >
      <Row gap={10} style={{ marginTop: 12 }}>
        <Logo size={30} />
        <T v="headline" weight="800">
          rehab
        </T>
      </Row>
      <T v="display" style={{ marginTop: 48 }}>
        Connect your account
      </T>
      <T v="body" color={C.ink2} style={{ marginTop: 10 }}>
        Enter your server address and the personal access token you were given.
      </T>
      <View style={{ gap: 18, marginTop: 32 }}>
        <View style={{ gap: 8 }}>
          <T v="caption" weight="700" color={C.ink2}>
            Server address
          </T>
          <TextInput
            accessibilityLabel="Server address"
            style={s.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://your-api.up.railway.app"
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={{ gap: 8 }}>
          <T v="caption" weight="700" color={C.ink2}>
            Personal access token
          </T>
          <TextInput
            accessibilityLabel="Personal access token"
            style={s.input}
            value={token}
            onChangeText={setToken}
            placeholder="rehab_…"
            placeholderTextColor={C.faint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => url && token && !busy && submit()}
          />
        </View>
        {!!error && (
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: C.badSoft }}>
            <T v="callout" color={C.bad}>
              {error}
            </T>
          </View>
        )}
        <T v="caption" color={C.muted}>
          The token is kept in this device’s secure storage.
          {Platform.OS === 'web' ? ' In a browser it lasts until the tab is closed.' : ''}
        </T>
      </View>
    </Screen>
  );
}
