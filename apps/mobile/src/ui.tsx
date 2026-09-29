import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useStore } from './store';

/* ─── Tokens ─────────────────────────────────────────────────────────── */

export const C = {
  bg: '#F4F4F1',
  surface: '#FFFFFF',
  ink: '#101211',
  ink2: '#4A504D',
  muted: '#80867F',
  faint: '#B8BCB6',
  line: '#E5E6E1',
  fill: '#ECEDE9',
  dark: '#131514',
  dark2: '#232624',
  onDarkMuted: '#9CA39E',
  accent: '#3654F5',
  accentSoft: '#E7EBFF',
  volt: '#D4F65B',
  good: '#138A52',
  goodSoft: '#E2F3E9',
  warn: '#A8651A',
  warnSoft: '#FBF0DC',
  bad: '#C8372D',
  badSoft: '#FBE7E5',
};

/** Identity colours for exercise categories. Validated as a categorical set. */
export const TONES = {
  mobility: '#1A9E8F',
  strength: '#F2661F',
  balance: '#7C5CFA',
  cardio: '#E5487A',
  other: '#3654F5',
} as const;
export type Tone = keyof typeof TONES;

export const RADIUS = { sm: 10, md: 14, lg: 20, xl: 26 };
export const PAD = 20;

const TYPE = {
  display: { fontSize: 34, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2 },
  title: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.8 },
  headline: { fontSize: 19, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', letterSpacing: -0.1 },
  strong: { fontSize: 15, lineHeight: 21, fontWeight: '600', letterSpacing: -0.2 },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  stat: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;
export type Variant = keyof typeof TYPE;

/* ─── Feedback ───────────────────────────────────────────────────────── */

const native = Platform.OS !== 'web';
export const haptic = {
  tap: () => native && void Haptics.selectionAsync().catch(() => {}),
  press: () =>
    native && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () =>
    native &&
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};

/* ─── Primitives ─────────────────────────────────────────────────────── */

export function T({
  v = 'body',
  color = C.ink,
  weight,
  size,
  align,
  style,
  children,
  ...props
}: {
  v?: Variant;
  color?: string;
  weight?: TextStyle['fontWeight'];
  size?: number;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  return (
    <Text
      {...props}
      style={[
        TYPE[v],
        { color },
        weight !== undefined && { fontWeight: weight },
        size !== undefined && { fontSize: size, lineHeight: Math.round(size * 1.2) },
        align !== undefined && { textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export type IconName = React.ComponentProps<typeof Feather>['name'];
export function Icon({
  name,
  size = 20,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}

/** A pressable that gives a subtle, springy scale on touch. */
export function Tap({
  children,
  style,
  scale = 0.975,
  onPress,
  haptics = true,
  wrap,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Style for the outer pressable, e.g. flex sizing inside a row. */
  wrap?: StyleProp<ViewStyle>;
  scale?: number;
  haptics?: boolean;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(s, {
      toValue: value,
      useNativeDriver: native,
      speed: 40,
      bounciness: value === 1 ? 6 : 0,
    }).start();
  return (
    <Pressable
      {...props}
      style={wrap}
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (haptics) haptic.tap();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Row({
  children,
  style,
  gap = 10,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: C.line }, style]} />;
}

/* ─── Buttons ────────────────────────────────────────────────────────── */

type ButtonKind = 'primary' | 'volt' | 'secondary' | 'ghost' | 'danger';
const BUTTON: Record<ButtonKind, { bg: string; fg: string }> = {
  primary: { bg: C.ink, fg: '#FFFFFF' },
  volt: { bg: C.volt, fg: C.ink },
  secondary: { bg: C.fill, fg: C.ink },
  ghost: { bg: 'transparent', fg: C.ink },
  danger: { bg: C.badSoft, fg: C.bad },
};
export function Button({
  title,
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  icon,
  iconRight,
  small = false,
  style,
  wrap,
}: {
  title: string;
  /** Accessible name, when it should differ from the visible title. */
  label?: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  wrap?: StyleProp<ViewStyle>;
}) {
  const c = BUTTON[kind];
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      haptics={false}
      wrap={wrap}
      style={[
        s.button,
        {
          backgroundColor: c.bg,
          minHeight: small ? 40 : 54,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: small ? 12 : 16,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={small ? 15 : 18} color={c.fg} />}
      <T v="strong" size={small ? 13 : 16} weight="700" color={c.fg}>
        {title}
      </T>
      {iconRight && <Icon name={iconRight} size={small ? 15 : 18} color={c.fg} />}
    </Tap>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  dark = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  dark?: boolean;
}) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      scale={0.92}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: dark ? C.dark2 : C.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: dark ? 0 : StyleSheet.hairlineWidth,
        borderColor: C.line,
      }}
    >
      <Icon name={icon} size={20} color={dark ? '#FFF' : C.ink} />
    </Tap>
  );
}

/* ─── Labels & tags ──────────────────────────────────────────────────── */

export function Tag({
  children,
  color = C.ink2,
  bg = C.fill,
  dot,
  icon,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  dot?: string;
  icon?: IconName;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: bg,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
      }}
    >
      {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
      {icon && <Icon name={icon} size={12} color={color} />}
      <T v="caption" weight="600" color={color}>
        {children}
      </T>
    </View>
  );
}

export function SectionHeader({
  title,
  aside,
  style,
}: {
  title: string;
  aside?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row style={[{ justifyContent: 'space-between', marginTop: 32, marginBottom: 12 }, style]}>
      <T v="headline">{title}</T>
      {typeof aside === 'string' ? (
        <T v="caption" color={C.muted}>
          {aside}
        </T>
      ) : (
        aside
      )}
    </Row>
  );
}

export function Stat({
  value,
  unit,
  label,
  color = C.ink,
  sub = C.muted,
  size = 30,
}: {
  value: React.ReactNode;
  unit?: string;
  label: string;
  color?: string;
  sub?: string;
  size?: number;
}) {
  return (
    <View style={{ gap: 2 }}>
      <T v="stat" size={size} color={color} style={{ lineHeight: size * 1.12 }}>
        {value}
        {unit && (
          <T v="strong" size={Math.max(13, size * 0.45)} color={sub} style={{ letterSpacing: 0 }}>
            {' '}
            {unit}
          </T>
        )}
      </T>
      <T v="caption" color={sub}>
        {label}
      </T>
    </View>
  );
}

/* ─── Progress ───────────────────────────────────────────────────────── */

export function Bar({
  value,
  color = C.accent,
  track = C.fill,
  height = 6,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View
        style={{ width: `${v * 100}%`, height, borderRadius: height, backgroundColor: color }}
      />
    </View>
  );
}

/** Segments whose relative widths show the shape of a session. */
export function StructureBar({
  segments,
  height = 8,
}: {
  segments: { weight: number; color: string }[];
  height?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, height }}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={{ flex: seg.weight, backgroundColor: seg.color, borderRadius: height / 2 }}
        />
      ))}
    </View>
  );
}

export function Segmented<V extends string | number>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: C.fill, padding: 3, borderRadius: 12 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 9,
              alignItems: 'center',
              borderRadius: 10,
              backgroundColor: on ? C.surface : 'transparent',
              ...(on ? s.lift : null),
            }}
          >
            <T v="caption" size={13} weight={on ? '700' : '500'} color={on ? C.ink : C.muted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Screens ────────────────────────────────────────────────────────── */

export function Header({
  overline,
  title,
  right,
}: {
  overline?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {overline && (
          <T v="overline" color={C.muted}>
            {overline}
          </T>
        )}
        <T v="display" accessibilityRole="header">
          {title}
        </T>
      </View>
      {right}
    </Row>
  );
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function TopBar({
  icon = 'chevron-left',
  label = 'Back',
  right,
}: {
  icon?: IconName;
  label?: string;
  right?: React.ReactNode;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 18, minHeight: 44 }}>
      <IconButton icon={icon} label={label} onPress={goBack} />
      {right}
    </Row>
  );
}

export function Screen({
  children,
  refresh = true,
  footer,
}: {
  children: React.ReactNode;
  refresh?: boolean;
  footer?: React.ReactNode;
}) {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const rejected = store.outbox.some((j) => j.error);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={store.syncing}
              onRefresh={() => void store.sync()}
              tintColor={C.muted}
            />
          ) : undefined
        }
      >
        {store.connection && store.error && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void store.sync()}
            style={[s.banner, { backgroundColor: rejected ? C.badSoft : C.warnSoft }]}
          >
            <Icon
              name={rejected ? 'alert-circle' : 'cloud-off'}
              size={16}
              color={rejected ? C.bad : C.warn}
            />
            <T v="caption" size={13} color={C.ink} style={{ flex: 1 }}>
              {rejected ? 'A saved change was rejected. Review it in Settings.' : store.error}
            </T>
            <T v="caption" weight="700" color={rejected ? C.bad : C.warn}>
              Retry
            </T>
          </Pressable>
        )}
        {children}
        <View style={{ height: footer ? 24 : 40 }} />
      </ScrollView>
      {footer && (
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={s.inner}>{footer}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function Loading() {
  return (
    <View
      style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <ActivityIndicator color={C.ink} />
    </View>
  );
}

export function Empty({
  icon = 'calendar',
  title,
  body,
}: {
  icon?: IconName;
  title: string;
  body?: string;
}) {
  return (
    <View style={[s.card, { alignItems: 'center', paddingVertical: 32, gap: 10 }]}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={20} color={C.ink2} />
      </View>
      <T v="strong" align="center">
        {title}
      </T>
      {body && (
        <T v="callout" color={C.muted} align="center" style={{ maxWidth: 280 }}>
          {body}
        </T>
      )}
    </View>
  );
}

/** A small geometric mark used for the wordmark and app icon. */
export function Logo({ size = 28, color = C.ink, accent = C.volt }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexDirection: 'row',
        paddingHorizontal: size * 0.2,
        paddingBottom: size * 0.22,
        gap: size * 0.08,
      }}
    >
      {[0.28, 0.44, 0.6].map((h, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: size * h,
            borderRadius: size * 0.06,
            backgroundColor: i === 2 ? accent : '#FFFFFF',
            alignSelf: 'flex-end',
          }}
        />
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.lg,
    padding: 18,
  },
  lift: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    backgroundColor: C.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.ink,
    minHeight: 52,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.fill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
