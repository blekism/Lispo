/**
 * Task card with two swipe directions:
 * - Swipe LEFT past the threshold -> toggles done (mark / undo). Snaps back.
 * - Swipe RIGHT -> stays open, revealing Edit and Delete buttons on the left.
 *
 * Built on the Gesture Handler v3 hook API + Reanimated so the drag runs on the
 * UI thread (smooth even when JS is busy). JS callbacks are hopped to with
 * scheduleOnRN.
 */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Check, Pencil, RotateCcw, Trash2 } from 'lucide-react-native';
import { formatMinutes } from '../lib/dates';
import { radius, space, useTheme } from '../theme';
import { Badge, Text } from './ui';

const ACTIONS_WIDTH = 148;
const DONE_THRESHOLD = 110;
const SPRING = { damping: 20, stiffness: 220, mass: 0.6 };

export type SwipeTaskCardProps = {
  id: number;
  title: string;
  notes?: string | null;
  timeMinutes: number;
  done: boolean;
  badge?: string;
  isOpen: boolean;
  onOpen: (id: number) => void;
  onClose: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function SwipeTaskCard(props: SwipeTaskCardProps) {
  const { colors } = useTheme();
  const tx = useSharedValue(0);
  const start = useSharedValue(0);
  const crossed = useSharedValue(false);

  // Close when another card opens.
  useEffect(() => {
    if (!props.isOpen && tx.value > 0) tx.value = withSpring(0, SPRING);
  }, [props.isOpen, tx]);

  const tick = () => Haptics.selectionAsync().catch(() => {});
  const confirmHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  const toggle = () => {
    confirmHaptic();
    props.onToggleDone();
  };
  const open = () => props.onOpen(props.id);
  const close = () => props.onClose();

  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onBegin: () => {
      'worklet';
      start.value = tx.value;
      crossed.value = false;
    },
    onUpdate: (e) => {
      'worklet';
      const next = start.value + e.translationX;
      // Resist past the action width on the right side.
      tx.value = next > ACTIONS_WIDTH ? ACTIONS_WIDTH + (next - ACTIONS_WIDTH) * 0.25 : next;
      const past = tx.value < -DONE_THRESHOLD;
      if (past !== crossed.value) {
        crossed.value = past;
        scheduleOnRN(tick);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (tx.value < -DONE_THRESHOLD) {
        tx.value = withSpring(0, SPRING);
        scheduleOnRN(toggle);
        scheduleOnRN(close);
      } else if (tx.value > ACTIONS_WIDTH / 2.5 || (e.velocityX > 600 && tx.value > 0)) {
        tx.value = withSpring(ACTIONS_WIDTH, SPRING);
        scheduleOnRN(open);
      } else {
        tx.value = withSpring(0, SPRING);
        scheduleOnRN(close);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const doneBgStyle = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-DONE_THRESHOLD, -10, 0], [1, 0.4, 0], 'clamp') }));
  const doneIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(tx.value, [-DONE_THRESHOLD - 20, -DONE_THRESHOLD, -40], [1.15, 1, 0.7], 'clamp') }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, 40, ACTIONS_WIDTH], [0, 0.6, 1], 'clamp') }));

  const animateClosed = (then: () => void) => {
    tx.value = withTiming(0, { duration: 160 });
    then();
  };

  return (
    <View style={styles.container}>
      {/* Right-swipe actions (revealed on the left side) */}
      <Animated.View style={[styles.leftActions, actionsStyle]}>
        <Pressable
          onPress={() => animateClosed(props.onEdit)}
          style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          accessibilityLabel="Edit task"
        >
          <Pencil size={18} color={colors.foreground} />
          <Text variant="small" style={{ fontWeight: '600' }}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => animateClosed(props.onDelete)}
          style={[styles.actionBtn, { backgroundColor: colors.destructive, borderColor: colors.destructive }]}
          accessibilityLabel="Delete task"
        >
          <Trash2 size={18} color={colors.destructiveForeground} />
          <Text variant="small" style={{ fontWeight: '600', color: colors.destructiveForeground }}>Delete</Text>
        </Pressable>
      </Animated.View>

      {/* Left-swipe "done" backdrop (revealed on the right side) */}
      <Animated.View pointerEvents="none" style={[styles.doneBg, { backgroundColor: props.done ? colors.secondary : colors.lit }, doneBgStyle]}>
        <Animated.View style={[styles.doneInner, doneIconStyle]}>
          {props.done ? <RotateCcw size={20} color={colors.foreground} /> : <Check size={22} color={colors.litForeground} />}
          <Text variant="small" style={{ fontWeight: '700', color: props.done ? colors.foreground : colors.litForeground }}>
            {props.done ? 'Undo' : 'Done'}
          </Text>
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, cardStyle]}>
          <View style={[styles.check, { borderColor: props.done ? colors.lit : colors.input, backgroundColor: props.done ? colors.lit : 'transparent' }]}>
            {props.done ? <Check size={14} color={colors.litForeground} strokeWidth={3} /> : null}
          </View>
          <View style={{ flex: 1, opacity: props.done ? 0.5 : 1 }}>
            <Text
              variant="large"
              numberOfLines={2}
              style={props.done ? { textDecorationLine: 'line-through', color: colors.mutedForeground } : undefined}
            >
              {props.title}
            </Text>
            {props.notes ? <Text variant="muted" numberOfLines={1}>{props.notes}</Text> : null}
            {props.badge ? <View style={{ marginTop: 6 }}><Badge label={props.badge} tone="muted" /></View> : null}
          </View>
          <Text variant="muted" style={{ fontVariant: ['tabular-nums'], opacity: props.done ? 0.5 : 1 }}>
            {formatMinutes(props.timeMinutes)}
          </Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space(3.5),
    paddingHorizontal: space(4),
    minHeight: 64,
  },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  leftActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space(2),
    width: ACTIONS_WIDTH - space(2),
  },
  actionBtn: { flex: 1, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  doneBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.lg, alignItems: 'flex-end', justifyContent: 'center', paddingRight: space(6) },
  doneInner: { alignItems: 'center', gap: 2 },
});
