import React from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../src/store';
import { NotificationManager } from '../src/notifications';
import { C } from '../src/ui';
const client = new QueryClient();
export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StoreProvider>
          <StatusBar style="dark" />
          <NotificationManager />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: C.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="session/[id]" />
            <Stack.Screen name="assessment/[id]" options={{ presentation: 'modal' }} />
          </Stack>
        </StoreProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
