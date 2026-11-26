/**
 * Month grid and year overview. Fully cleared days are "lit" in solid green,
 * partial days get a lighter shade (GitHub-contribution style).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DateKey, MONTHS, WEEKDAYS_INITIAL, fromKey, monthKeys, weekdayOf } from '../lib/dates';
import { DayStat, DayStatus, statusOf } from '../lib/streak';
import { Colors, radius, space, useTheme } from '../theme';
import { Text } from './ui';

export function cellColors(status: DayStatus, stat: DayStat | undefined, colors: Colors) {
  const ratio = stat && stat.total ? stat.done / stat.total : 0;
  switch (status) {
    case 'perfect':
      return { bg: colors.lit, fg: colors.litForeground, border: colors.lit };
    case 'partial':
    case 'pending':
      if (ratio === 0) return { bg: status === 'pending' ? 'transparent' : colors.muted, fg: colors.foreground, border: status === 'pending' ? colors.border : colors.muted };
      return { bg: ratio >= 0.5 ? colors.litMid : colors.litSoft, fg: colors.foreground, border: 'transparent' };
    case 'missed':
      return { bg: colors.muted, fg: colors.mutedForeground, border: colors.muted };
    case 'rest':
      return { bg: 'transparent', fg: colors.mutedForeground, border: colors.border };
    default:
      return { bg: 'transparent', fg: colors.mutedForeground, border: 'transparent' };
  }
}

export function MonthGrid({
  year,
  month,
  stats,
  today,
  selected,
  onSelect,
}: {
  year: number;
  month: number;
  stats: Map<DateKey, DayStat>;
  today: DateKey;
  selected?: DateKey | null;
  onSelect?: (d: DateKey) => void;
}) {
  const { colors } = useTheme();
  const keys = monthKeys(year, month);
  const lead = weekdayOf(keys[0]);
  const cells: (DateKey | null)[] = [...Array(lead).fill(null), ...keys];
  while (cells.length % 7) cells.push(null);

  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS_INITIAL.map((d, i) => (
          <Text key={i} variant="muted" style={styles.head}>{d}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.week}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={styles.cellWrap} />;
            const st = statusOf(stats.get(d), d, today);
            const c = cellColors(st, stats.get(d), colors);
            const isSel = selected === d;
            return (
              <Pressable key={d} style={styles.cellWrap} onPress={() => onSelect?.(d)} disabled={st === 'future' || st === 'untracked'}>
                <View
                  style={[
                    styles.cell,
                    {
                      backgroundColor: c.bg,
                      borderColor: isSel ? colors.foreground : d === today ? colors.foreground : c.border,
                      borderStyle: st === 'rest' ? 'dashed' : 'solid',
                      borderWidth: isSel || d === today ? 2 : 1,
                      opacity: st === 'future' || st === 'untracked' ? 0.4 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: st === 'perfect' ? '700' : '500', color: c.fg }}>{fromKey(d).getDate()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function YearView({ year, stats, today, onPickMonth }: { year: number; stats: Map<DateKey, DayStat>; today: DateKey; onPickMonth: (m: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.yearGrid}>
      {MONTHS.map((name, m) => {
        const keys = monthKeys(year, m);
        const lead = weekdayOf(keys[0]);
        const statuses = keys.map((k) => statusOf(stats.get(k), k, today));
        const perfect = statuses.filter((s) => s === 'perfect').length;
        const tracked = statuses.filter((s) => s === 'perfect' || s === 'partial' || s === 'missed').length;
        const monthOver = keys[keys.length - 1] < today;
        const fullyLit = monthOver && tracked > 0 && perfect === tracked && !statuses.includes('untracked');
        return (
          <Pressable key={name} style={[styles.mini, { borderColor: fullyLit ? colors.lit : colors.border }]} onPress={() => onPickMonth(m)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="label" style={{ fontSize: 12 }}>{name.slice(0, 3)}</Text>
              <Text variant="muted" style={{ fontSize: 11, color: perfect ? colors.lit : colors.mutedForeground }}>{perfect || ''}</Text>
            </View>
            <View style={styles.miniGrid}>
              {Array.from({ length: lead }, (_, i) => (
                <View key={`l${i}`} style={styles.miniCell} />
              ))}
              {keys.map((k, i) => {
                const c = cellColors(statuses[i], stats.get(k), colors);
                const empty = statuses[i] === 'future' || statuses[i] === 'untracked';
                return <View key={k} style={[styles.miniCell, { backgroundColor: empty ? colors.muted : c.bg === 'transparent' ? colors.muted : c.bg, opacity: empty ? 0.5 : 1 }]} />;
              })}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontSize: 12, marginBottom: space(2) },
  cellWrap: { flex: 1, aspectRatio: 1, padding: 3 },
  cell: { flex: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  mini: { width: '31.5%', borderWidth: 1, borderRadius: radius.md, padding: space(2), gap: space(1.5) },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  miniCell: { width: `${100 / 7 - 2}%`, aspectRatio: 1, margin: '1%', borderRadius: 2 },
});
