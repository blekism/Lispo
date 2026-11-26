/**
 * Calendar: streak, month/year view of lit days, and a few metrics.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react-native';
import { canEditDate, getDayStats, getDayTasks, getMostMissedTask, getTotalDone, setDone } from '../../db/repo';
import { useQuery } from '../../hooks/useQuery';
import { DateKey, MONTHS, formatMinutes, fromKey, prettyDate, todayKey } from '../../lib/dates';
import { currentStreak, longestStreak, monthMetrics, statusOf, streakMessage } from '../../lib/streak';
import { MonthGrid, YearView, cellColors } from '../../components/CalendarGrids';
import { TaskCheckRow } from '../../components/FixYesterdaySheet';
import { Card, Segmented, Text } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';

export default function CalendarScreen() {
  const { colors } = useTheme();
  const today = todayKey();
  const now = fromKey(today);
  const [view, setView] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<DateKey | null>(null);

  const { data } = useQuery(async () => {
    const [stats, missed, totalDone] = await Promise.all([getDayStats(), getMostMissedTask(today), getTotalDone()]);
    return { stats, missed, totalDone };
  }, [today]);
  const { data: dayTasks } = useQuery(async () => (selected ? getDayTasks(selected) : []), [selected]);

  const statMap = useMemo(() => new Map((data?.stats ?? []).map((s) => [s.date, s])), [data?.stats]);
  if (!data) return <View style={{ flex: 1 }} />;

  const streak = currentStreak(data.stats, today);
  const best = longestStreak(data.stats, today);
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const mm = monthMetrics(data.stats, today, prefix);
  const firstTracked = data.stats[0]?.date;
  const todayCleared = statusOf(statMap.get(today), today, today) === 'perfect';

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
  };
  const canGoBack = view === 'month' ? !!firstTracked && `${prefix}-01` > firstTracked : !!firstTracked && `${year}-01-01` > firstTracked;
  const canGoForward = view === 'month' ? `${prefix}-31` < today : year < now.getFullYear();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="h1">Calendar</Text>

        <Card style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: streak ? colors.litSoft : colors.muted }]}>
            <Flame size={28} color={streak ? colors.lit : colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="muted">Current streak</Text>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.foreground, letterSpacing: -1 }}>
              {streak} <Text variant="muted" style={{ fontSize: 15 }}>{streak === 1 ? 'day' : 'days'}</Text>
            </Text>
            <Text variant="muted">{streakMessage(streak, todayCleared)}</Text>
          </View>
        </Card>

        <Segmented
          value={view}
          onChange={(v) => {
            setView(v);
            setSelected(null);
          }}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />

        <Card style={{ gap: space(3) }}>
          <View style={styles.nav}>
            <NavBtn disabled={!canGoBack} onPress={() => (view === 'month' ? shiftMonth(-1) : setYear(year - 1))} dir="left" />
            <Text variant="h3">{view === 'month' ? `${MONTHS[month]} ${year}` : year}</Text>
            <NavBtn disabled={!canGoForward} onPress={() => (view === 'month' ? shiftMonth(1) : setYear(year + 1))} dir="right" />
          </View>
          {view === 'month' ? (
            <MonthGrid year={year} month={month} stats={statMap} today={today} selected={selected} onSelect={(d) => setSelected(d === selected ? null : d)} />
          ) : (
            <YearView
              year={year}
              stats={statMap}
              today={today}
              onPickMonth={(m) => {
                setMonth(m);
                setView('month');
              }}
            />
          )}
          <Legend />
        </Card>

        {selected && view === 'month' ? (
          <Card style={{ gap: space(2) }}>
            <Text variant="label">{prettyDate(selected)}</Text>
            {(dayTasks ?? []).length === 0 ? (
              <Text variant="muted">Rest day.</Text>
            ) : (
              (dayTasks ?? []).map((t) => (
                <TaskCheckRow
                  key={t.id}
                  title={t.title}
                  sub={t.doneLate ? `${formatMinutes(t.timeMinutes)} · late` : formatMinutes(t.timeMinutes)}
                  checked={!!t.doneAt}
                  onPress={canEditDate(selected, today) ? () => setDone(t.id, !t.doneAt) : undefined}
                />
              ))
            )}
            {!canEditDate(selected, today) ? <Text variant="muted">Only today and yesterday can be changed.</Text> : null}
          </Card>
        ) : null}

        <View style={styles.metrics}>
          <Metric label={`Perfect days in ${MONTHS[month].slice(0, 3)}`} value={String(mm.perfectDays)} sub={mm.trackedDays ? `of ${mm.trackedDays} tracked` : 'none tracked yet'} />
          <Metric label="Completion this month" value={`${Math.round(mm.completionRate * 100)}%`} sub="of tasks done" />
          <Metric label="Longest streak" value={String(best)} sub={best === 1 ? 'day' : 'days'} icon={<Trophy size={14} color={colors.mutedForeground} />} />
          <Metric label="Tasks completed" value={String(data.totalDone)} sub="all time" />
        </View>

        {data.missed ? (
          <Card style={{ gap: 2 }}>
            <Text variant="muted">Most missed (last 30 days)</Text>
            <Text variant="large">{data.missed.title}</Text>
            <Text variant="muted">Missed {data.missed.misses} {data.missed.misses === 1 ? 'time' : 'times'}. Maybe try a different time for it?</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function NavBtn({ dir, disabled, onPress }: { dir: 'left' | 'right'; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <Pressable disabled={disabled} onPress={onPress} hitSlop={10} style={[styles.navBtn, { borderColor: colors.border, opacity: disabled ? 0.35 : 1 }]}>
      <Icon size={18} color={colors.foreground} />
    </Pressable>
  );
}

function Metric({ label, value, sub, icon }: { label: string; value: string; sub: string; icon?: React.ReactNode }) {
  return (
    <Card style={styles.metric}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon}
        <Text variant="muted" style={{ fontSize: 12 }} numberOfLines={1}>{label}</Text>
      </View>
      <Text variant="h2" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text variant="muted" style={{ fontSize: 12 }}>{sub}</Text>
    </Card>
  );
}

function Legend() {
  const { colors } = useTheme();
  const items = [
    { label: 'Cleared', ...cellColors('perfect', undefined, colors) },
    { label: 'Partial', ...cellColors('partial', { date: '', total: 2, done: 1 }, colors) },
    { label: 'Missed', ...cellColors('missed', undefined, colors) },
    { label: 'Rest', ...cellColors('rest', undefined, colors), dashed: true },
  ];
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.swatch, { backgroundColor: i.bg, borderColor: i.border, borderStyle: 'dashed' in i ? 'dashed' : 'solid' }]} />
          <Text variant="muted" style={{ fontSize: 12 }}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(4), paddingBottom: space(12) },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  heroIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  metric: { width: '47.8%', gap: 2, padding: space(3.5) },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space(4), flexWrap: 'wrap' },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
});
