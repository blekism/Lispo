/**
 * "Fix yesterday": tick off tasks from yesterday you forgot to mark.
 * Only yesterday is allowed (agreed rule), so streaks stay honest.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { DayTask, setDone } from '../db/repo';
import { DateKey, formatMinutes, prettyDate } from '../lib/dates';
import { radius, space, useTheme } from '../theme';
import { Button, Text } from './ui';

export function FixYesterdaySheet({ visible, date, tasks, onClose }: { visible: boolean; date: DateKey; tasks: DayTask[]; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text variant="h3">Fix yesterday</Text>
          <Text variant="muted" style={{ marginTop: 2 }}>{prettyDate(date)} · tap the tasks you actually did</Text>
          <View style={{ gap: space(2), marginTop: space(4) }}>
            {tasks.map((t) => (
              <TaskCheckRow key={t.id} title={t.title} sub={formatMinutes(t.timeMinutes)} checked={!!t.doneAt} onPress={() => setDone(t.id, !t.doneAt)} />
            ))}
          </View>
          <Button title="Done" onPress={onClose} style={{ marginTop: space(5) }} />
        </View>
      </View>
    </Modal>
  );
}

export function TaskCheckRow({ title, sub, checked, onPress }: { title: string; sub?: string; checked: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.row, { borderColor: colors.border }]}>
      <View style={[styles.box, { borderColor: checked ? colors.lit : colors.input, backgroundColor: checked ? colors.lit : 'transparent' }]}>
        {checked ? <Check size={13} color={colors.litForeground} strokeWidth={3} /> : null}
      </View>
      <Text style={{ flex: 1, color: checked ? colors.mutedForeground : colors.foreground }} numberOfLines={1}>
        {title}
      </Text>
      {sub ? <Text variant="muted">{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, padding: space(5), paddingBottom: space(8) },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderWidth: 1, borderRadius: radius.md, padding: space(3) },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
