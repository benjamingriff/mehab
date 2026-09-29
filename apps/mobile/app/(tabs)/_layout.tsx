import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Icon } from '../../src/ui';
export default function Layout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: '#9A9F95',
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.line,
          height: 72 + Math.max(insets.bottom, 12),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { minHeight: 56 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {[
        ['index', 'Today', 'sun'],
        ['programme', 'Programme', 'layers'],
        ['progress', 'Progress', 'activity'],
        ['settings', 'Settings', 'sliders'],
      ].map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => <Icon name={icon as any} size={21} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
