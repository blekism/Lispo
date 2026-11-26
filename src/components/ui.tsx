/**
 * shadcn-inspired primitives: plain StyleSheet + theme tokens, no UI library.
 * Kept in one file because each piece is small.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { radius, space, useTheme } from '../theme';

// ---------------------------------------------------------------- Text

type TextVariant = 'h1' | 'h2' | 'h3' | 'p' | 'small' | 'muted' | 'label' | 'large';

export function Text({ variant = 'p', style, ...rest }: TextProps & { variant?: TextVariant }) {
  const { colors } = useTheme();
  const base: Record<TextVariant, TextStyle> = {
    h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: colors.foreground },
    h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.foreground },
    h3: { fontSize: 17, fontWeight: '600', color: colors.foreground },
    large: { fontSize: 16, fontWeight: '600', color: colors.foreground },
    p: { fontSize: 15, lineHeight: 21, color: colors.foreground },
    small: { fontSize: 13, color: colors.foreground },
    muted: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
    label: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  };
  return <RNText style={[base[variant], style]} {...rest} />;
}

// ---------------------------------------------------------------- Button

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'lit';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export function Button({
  title,
  variant = 'default',
  size = 'md',
  icon,
  loading,
  disabled,
  style,
  textStyle,
  ...rest
}: Omit<PressableProps, 'style'> & {
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    default: { bg: colors.primary, fg: colors.primaryForeground },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.foreground },
    destructive: { bg: colors.destructive, fg: colors.destructiveForeground },
    lit: { bg: colors.lit, fg: colors.litForeground },
  };
  const sizes: Record<ButtonSize, ViewStyle> = {
    sm: { height: 34, paddingHorizontal: space(3) },
    md: { height: 42, paddingHorizontal: space(4) },
    lg: { height: 50, paddingHorizontal: space(5) },
    icon: { height: 40, width: 40 },
  };
  const p = palette[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        sizes[size],
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent', opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon}
          {title ? (
            <RNText style={[{ color: p.fg, fontSize: size === 'sm' ? 13 : 15, fontWeight: '600' }, textStyle]}>{title}</RNText>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Card

export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]} {...rest} />;
}

// ---------------------------------------------------------------- Input

export function Input({ style, label, hint, ...rest }: TextInputProps & { label?: string; hint?: string }) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: space(1.5) }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          { color: colors.foreground, borderColor: focused ? colors.mutedForeground : colors.input, backgroundColor: colors.background },
          style,
        ]}
        {...rest}
      />
      {hint ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Badge

export function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'lit' | 'outline' | 'muted' }) {
  const { colors } = useTheme();
  const map = {
    default: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    lit: { bg: colors.litSoft, fg: colors.lit, border: colors.litSoft },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    muted: { bg: colors.muted, fg: colors.mutedForeground, border: colors.muted },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg, borderColor: map.border }]}>
      <RNText style={{ color: map.fg, fontSize: 11, fontWeight: '600' }}>{label}</RNText>
    </View>
  );
}

// ---------------------------------------------------------------- Separator

export function Separator({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

// ---------------------------------------------------------------- Segmented (shadcn Tabs look)

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.muted }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
          >
            <RNText style={{ fontSize: 13, fontWeight: '600', color: active ? colors.foreground : colors.mutedForeground }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Chip (selectable pill)

export function Chip({ label, selected, onPress, dot }: { label: string; selected?: boolean; onPress?: () => void; dot?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.background,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <RNText style={{ fontSize: 13, fontWeight: '600', color: selected ? colors.primaryForeground : colors.foreground }}>{label}</RNText>
      {dot ? <View style={[styles.dot, { backgroundColor: selected ? colors.primaryForeground : colors.lit }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    borderRadius: radius.md,
    borderWidth: 1,
  },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space(4) },
  input: { height: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space(3), fontSize: 15 },
  badge: { borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: radius.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
