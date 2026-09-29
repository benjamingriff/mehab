import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { router } from 'expo-router';
import { useStore } from './store';
export const C = {
  bg: '#F8F7F3',
  paper: '#FFFFFF',
  ink: '#223E35',
  muted: '#7A8178',
  line: '#E7E9E0',
  green: '#2D5948',
  pale: '#EAF0E5',
  lime: '#D5E8B5',
  sand: '#F0E9DC',
  orange: '#B77751',
  red: '#A3483F',
};
export function T({
  children,
  size = 15,
  color = C.ink,
  weight = '400',
  serif = false,
  style,
  ...props
}: any) {
  return (
    <Text
      {...props}
      style={[
        {
          fontSize: size,
          color,
          fontWeight: weight,
          fontFamily: serif ? 'Georgia' : undefined,
          lineHeight: size * 1.38,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 20,
  color = C.ink,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  small = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Feather>['name'];
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? C.pale : C.green,
          paddingVertical: small ? 12 : 17,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon && <Icon name={icon} size={18} color={secondary ? C.green : 'white'} />}
      <T size={small ? 13 : 15} weight="600" color={secondary ? C.green : 'white'}>
        {title}
      </T>
    </Pressable>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <T
      size={10}
      weight="700"
      color={C.muted}
      style={{ letterSpacing: 1.7, textTransform: 'uppercase' }}
    >
      {children}
    </T>
  );
}
export function Section({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 30, marginBottom: 16 }}>
      <T size={23} serif>
        {title}
      </T>
      {aside}
    </Row>
  );
}
export function Pill({ children, color = C.green, bg = C.pale }: any) {
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: 'flex-start',
      }}
    >
      <T size={11} weight="600" color={color}>
        {children}
      </T>
    </View>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ padding: 28, gap: 12 }}>
      <Icon name="sun" color={C.green} size={28} />
      <T serif size={24}>
        {title}
      </T>
      <T color={C.muted}>{body}</T>
    </Card>
  );
}
export function Back({ title = 'Back' }: { title?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        minHeight: 44,
        marginBottom: 14,
      }}
    >
      <Icon name="arrow-left" size={19} />
      <T size={14}>{title}</T>
    </Pressable>
  );
}
export function Screen({
  children,
  refresh = true,
}: {
  children: React.ReactNode;
  refresh?: boolean;
}) {
  const store = useStore();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={store.syncing}
              onRefresh={() => void store.sync()}
              tintColor={C.green}
            />
          ) : undefined
        }
      >
        {store.connection && store.error && (
          <Pressable onPress={() => void store.sync()} style={s.banner}>
            <Icon
              name={store.outbox.some((j) => j.error) ? 'alert-circle' : 'cloud-off'}
              size={15}
            />
            <T size={12} style={{ flex: 1 }}>
              {store.outbox.some((j) => j.error)
                ? 'A saved change needs attention in Settings.'
                : store.error}{' '}
              Tap to retry.
            </T>
          </Pressable>
        )}
        {children}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
export function Loading() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <ActivityIndicator color={C.green} />
      <T color={C.muted}>Making room for recovery.</T>
    </View>
  );
}
export function Botanical({ size = 150, color = '#B5C8A8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Path
        d="M80 149 C78 112 65 60 98 14 M79 113 C35 113 18 78 25 61 C60 59 80 84 79 113 M78 92 C114 93 140 68 138 44 C105 45 79 64 78 92 M80 61 C55 56 45 29 54 14 C77 21 86 40 80 61"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
      />
      <Path
        d="M79 112 L26 63 M79 91 L136 46 M80 61 L54 16"
        stroke={color}
        strokeWidth=".7"
        fill="none"
      />
    </Svg>
  );
}
export function Ring({
  value,
  size = 55,
  color = C.green,
}: {
  value: number;
  size?: number;
  color?: string;
}) {
  const r = 22,
    c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Circle cx="26" cy="26" r={r} fill="none" stroke={C.line} strokeWidth="4" />
      <Circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${Math.max(0, Math.min(1, value)) * c} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
    </Svg>
  );
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: {
    backgroundColor: C.paper,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.line,
  },
  button: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    minHeight: 44,
  },
  banner: {
    padding: 12,
    backgroundColor: C.sand,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: C.ink,
    minHeight: 52,
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 18 },
});
