import React, { useState } from 'react';
import { View, TextInput, Platform } from 'react-native';
import { useStore } from './store';
import { Botanical, Button, C, Card, Icon, Label, Row, Screen, T, s } from './ui';
export function Connect() {
  const store = useStore();
  const [url, setUrl] = useState(Platform.OS === 'web' ? 'http://localhost:3000' : '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Screen refresh={false}>
      <Row style={{ marginVertical: 20 }}>
        <Icon name="sun" size={24} />
        <T size={21} weight="600" style={{ letterSpacing: -0.5 }}>
          rehab
        </T>
        <View style={{ flex: 1 }} />
        <Label>YOUR DAILY PRACTICE</Label>
      </Row>
      <View style={{ alignItems: 'center', paddingVertical: 30 }}>
        <Botanical size={150} color={C.green} />
      </View>
      <T serif size={43} style={{ letterSpacing: -1.7 }}>
        A little each day.
      </T>
      <T size={17} color={C.muted} style={{ marginTop: 14, marginBottom: 30, lineHeight: 26 }}>
        Your plan, a moment to move, and space to notice how you feel.
      </T>
      <Card style={{ gap: 16 }}>
        <T size={20} serif>
          Welcome to your trial
        </T>
        <T color={C.muted} size={13}>
          Connect the app to your rehab account. Your programme will be ready when you are.
        </T>
        <Label>SERVER ADDRESS</Label>
        <TextInput
          accessibilityLabel="Server address"
          style={s.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://your-api.up.railway.app"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Label>PERSONAL ACCESS TOKEN</Label>
        <TextInput
          accessibilityLabel="Personal access token"
          style={s.input}
          value={token}
          onChangeText={setToken}
          placeholder="Paste your token"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!error && (
          <T color={C.red} size={13}>
            {error}
          </T>
        )}
        <Button
          title={busy ? 'Connecting…' : 'Connect my account'}
          icon="arrow-right"
          disabled={busy || !url || !token}
          onPress={() => {
            setBusy(true);
            setError('');
            store
              .connect(url, token)
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        />
      </Card>
      <T color={C.muted} size={12} style={{ textAlign: 'center', marginTop: 20 }}>
        Your token stays in this device’s secure storage.
        {Platform.OS === 'web' ? ' In this browser, it lasts for this tab’s session.' : ''}
      </T>
    </Screen>
  );
}
