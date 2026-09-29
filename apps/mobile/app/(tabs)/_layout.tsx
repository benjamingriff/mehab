import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../src/store';
import { C, Icon, haptic, type IconName } from '../../src/ui';
const TABS: [name: string, title: string, icon: IconName][] = [
  ['index', 'Today', 'home'],
  ['programme', 'Plan', 'calendar'],
  ['progress', 'Progress', 'bar-chart-2'],
  ['settings', 'Settings', 'settings'],
];
export default function Layout() {
  const insets = useSafeAreaInsets();
  const { connection, ready } = useStore();
  const bottom = Math.max(insets.bottom, 10);
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.faint,
        tabBarStyle: {
          display: ready && connection ? 'flex' : 'none',
          backgroundColor: C.surface,
          borderTopColor: C.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 58 + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <Icon name={icon} size={22} color={String(color)} />
                <View
                  style={{
                    position: 'absolute',
                    top: -9,
                    width: 18,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: focused ? C.ink : 'transparent',
                  }}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
