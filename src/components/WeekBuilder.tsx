/**
 * Edits a profile's weekly template: pick a weekday, add/edit/delete its
 * tasks, or copy a day onto other days. Used by the setup wizard and by the
 * "Edit routine" screen.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { TemplateTask, addTemplateTask, copyWeekday, deleteTemplateTask, listTemplateTasks, updateTemplateTask } from '../db/repo';
import { useQuery } from '../hooks/useQuery';
import { WEEKDAYS, WEEKDAYS_SHORT, formatMinutes } from '../lib/dates';
import { radius, space, useTheme } from '../theme';
import { DialogShell, useConfirm } from './Dialog';
import { TaskEditorSheet } from './TaskEditorSheet';
import { Button, Card, Chip, Text } from './ui';

export function WeekBuilder({ profileId, initialWeekday = 0, header }: { profileId: number; initialWeekday?: number; header?: React.ReactNode }) {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const [weekday, setWeekday] = useState(initialWeekday);
  const [editor, setEditor] = useState<{ task?: TemplateTask } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const { data: tasks = [] } = useQuery(() => listTemplateTasks(profileId), [profileId]);

  const dayTasks = tasks.filter((t) => t.weekday === weekday);
  const counts = WEEKDAYS.map((_, i) => tasks.filter((t) => t.weekday === i).length);

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(8) }}>
        {header}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {WEEKDAYS_SHORT.map((d, i) => (
            <Chip key={d} label={d} selected={i === weekday} dot={counts[i] > 0} onPress={() => setWeekday(i)} />
          ))}
        </ScrollView>

        <View style={styles.dayHeader}>
          <View>
            <Text variant="h3">{WEEKDAYS[weekday]}</Text>
            <Text variant="muted">{dayTasks.length === 0 ? 'Rest day (no tasks)' : `${dayTasks.length} ${dayTasks.length === 1 ? 'task' : 'tasks'}`}</Text>
          </View>
          {dayTasks.length > 0 ? (
            <Button size="sm" variant="outline" title="Copy to…" icon={<Copy size={14} color={colors.foreground} />} onPress={() => setCopyOpen(true)} />
          ) : null}
        </View>

        <View style={{ gap: space(2) }}>
          {dayTasks.map((t) => (
            <Card key={t.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text variant="large" numberOfLines={1}>{t.title}</Text>
                <Text variant="muted">{formatMinutes(t.timeMinutes)}{t.notes ? ` · ${t.notes}` : ''}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setEditor({ task: t })} style={styles.icon} accessibilityLabel="Edit">
                <Pencil size={17} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.icon}
                accessibilityLabel="Delete"
                onPress={async () => {
                  if (await confirm({ title: 'Delete task?', description: `Remove “${t.title}” from ${WEEKDAYS[weekday]}s.`, confirmText: 'Delete', destructive: true }))
                    await deleteTemplateTask(t.id);
                }}
              >
                <Trash2 size={17} color={colors.destructive} />
              </Pressable>
            </Card>
          ))}
          <Button variant="secondary" title={`Add task to ${WEEKDAYS[weekday]}`} icon={<Plus size={16} color={colors.foreground} />} onPress={() => setEditor({})} />
        </View>
      </ScrollView>

      <TaskEditorSheet
        visible={!!editor}
        heading={editor?.task ? 'Edit task' : `New ${WEEKDAYS[weekday]} task`}
        subheading={editor?.task ? 'Applies to today and future weeks.' : 'Repeats every week.'}
        initial={editor?.task ? { title: editor.task.title, timeMinutes: editor.task.timeMinutes, notes: editor.task.notes } : null}
        onClose={() => setEditor(null)}
        onSave={async (input) => {
          if (editor?.task) await updateTemplateTask(editor.task.id, input);
          else await addTemplateTask(profileId, weekday, input);
        }}
      />

      <CopyDayDialog
        visible={copyOpen}
        fromWeekday={weekday}
        onClose={() => setCopyOpen(false)}
        onCopy={async (targets) => {
          await copyWeekday(profileId, weekday, targets);
          setCopyOpen(false);
        }}
      />
    </>
  );
}

function CopyDayDialog({ visible, fromWeekday, onClose, onCopy }: { visible: boolean; fromWeekday: number; onClose: () => void; onCopy: (targets: number[]) => Promise<void> }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);
  const toggle = (i: number) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  const preset = (days: number[]) => setSelected(days.filter((d) => d !== fromWeekday));

  return (
    <DialogShell visible={visible} onClose={onClose}>
      <Text variant="h3">Copy {WEEKDAYS[fromWeekday]} to…</Text>
      <Text variant="muted" style={{ marginTop: 4 }}>Tasks are added to the days you pick. Exact duplicates are skipped.</Text>
      <View style={styles.chipWrap}>
        {WEEKDAYS_SHORT.map((d, i) =>
          i === fromWeekday ? null : <Chip key={d} label={d} selected={selected.includes(i)} onPress={() => toggle(i)} />
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(3) }}>
        <Button size="sm" variant="ghost" title="Weekdays" onPress={() => preset([0, 1, 2, 3, 4])} />
        <Button size="sm" variant="ghost" title="Weekend" onPress={() => preset([5, 6])} />
        <Button size="sm" variant="ghost" title="All" onPress={() => preset([0, 1, 2, 3, 4, 5, 6])} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space(2), marginTop: space(4) }}>
        <Button variant="outline" title="Cancel" onPress={onClose} />
        <Button
          title="Copy"
          loading={busy}
          disabled={!selected.length}
          onPress={async () => {
            setBusy(true);
            try {
              await onCopy(selected);
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </DialogShell>
  );
}

const styles = StyleSheet.create({
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  icon: { padding: 6, borderRadius: radius.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) },
});
