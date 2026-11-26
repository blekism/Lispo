/**
 * The card at the top of Today: streak number + Mon–Sun dots for this week.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Flame, Moon } from 'lucide-react-native';
import { DateKey, WEEKDAYS_INITIAL, fromKey } from '../lib/dates';
import { DayStat, DayStatus, statusOf, streakMessage } from '../lib/streak';
import { radius, space, useTheme } from '../theme';
import { Card, Text } from './ui';

export function WeekTracker({
  week,
  stats,
  today,
  streak,
}: {
  week: DateKey[];
  stats: Map<DateKey, DayStat>;
  today: DateKey;
  streak: number;
}) {
  const { colors } = useTheme();
  const statuses = week.map((d) => statusOf(stats.get(d), d, today));
  const clearedThisWeek = statuses.filter((s) => s === 'perfect').length;
  const todayCleared = statusOf(stats.get(today), today, today) === 'perfect';

  return (
    <Card style={{ gap: space(4) }}>
      <View style={styles.header}>
        <View style={[styles.flame, { backgroundColor: streak > 0 ? colors.litSoft : colors.muted }]}>
          <Flame size={22} color={streak > 0 ? colors.lit : colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="h1" style={{ fontVariant: ['tabular-nums'] }}>{streak}</Text>
            <Text variant="label" style={{ color: colors.mutedForeground }}>day streak</Text>
          </View>
          <Text variant="muted">{streakMessage(streak, todayCleared)}</Text>
        </View>
      </View>

      <View style={styles.row}>
        {week.map((d, i) => (
          <DayDot key={d} label={WEEKDAYS_INITIAL[i]} date={d} status={statuses[i]} isToday={d === today} />
        ))}
      </View>

      <Text variant="muted" style={{ textAlign: 'center' }}>
        {clearedThisWeek} of 7 days cleared this week
      </Text>
    </Card>
  );
}

function DayDot({ label, date, status, isToday }: { label: string; date: DateKey; status: DayStatus; isToday: boolean }) {
  const { colors } = useTheme();
  const lit = status === 'perfect';
  const bg = lit ? colors.lit : status === 'partial' ? colors.litSoft : 'transparent';
  const border = lit ? colors.lit : isToday ? colors.foreground : colors.border;
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Text variant="muted" style={{ fontWeight: isToday ? '700' : '500', color: isToday ? colors.foreground : colors.mutedForeground }}>
        {label}
      </Text>
      <View
        style={[
          styles.dot,
          { backgroundColor: bg, borderColor: border, borderStyle: status === 'rest' ? 'dashed' : 'solid', opacity: status === 'future' || status === 'untracked' ? 0.45 : 1 },
        ]}
      >
        {lit ? (
          <Check size={16} color={colors.litForeground} strokeWidth={3} />
        ) : status === 'rest' ? (
          <Moon size={13} color={colors.mutedForeground} />
        ) : (
          <Text variant="muted" style={{ fontSize: 12, color: isToday ? colors.foreground : colors.mutedForeground }}>
            {fromKey(date).getDate()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  flame: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
