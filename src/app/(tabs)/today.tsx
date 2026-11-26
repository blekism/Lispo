/**
 * Today: weekly streak tracker on top, then today's tasks as swipeable cards.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheckBig, Info, Plus, Settings, X } from 'lucide-react-native';
import {
  DayTask,
  SettingKeys,
  addTemplateTask,
  deleteTemplateTask,
  getActivatedAtMinutesToday,
  getActiveProfile,
  getDayStats,
  getDayTasks,
  getSetting,
  getTemplateTask,
  setDone,
  setSetting,
  updateTemplateTask,
  TaskInput,
} from '../../db/repo';
import { useQuery } from '../../hooks/useQuery';
import { WEEKDAYS, addDays, prettyDate, todayKey, weekKeys, weekdayOf } from '../../lib/dates';
import { currentStreak } from '../../lib/streak';
import { useConfirm } from '../../components/Dialog';
import { SwipeTaskCard } from '../../components/SwipeTaskCard';
import { TaskEditorSheet } from '../../components/TaskEditorSheet';
import { FixYesterdaySheet } from '../../components/FixYesterdaySheet';
import { WeekTracker } from '../../components/WeekTracker';
import { Badge, Button, Card, Text } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';

export default function TodayScreen() {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const weekdayName = WEEKDAYS[weekdayOf(today)];

  const { data } = useQuery(async () => {
    const [profile, tasks, stats, yTasks, activatedMins, hintDismissed] = await Promise.all([
      getActiveProfile(),
      getDayTasks(today),
      getDayStats(),
      getDayTasks(yesterday),
      getActivatedAtMinutesToday(),
      getSetting(SettingKeys.lastSetupHintDismissed),
    ]);
    return { profile, tasks, stats, yTasks, activatedMins, hintDismissed };
  }, [today]);

  const [openId, setOpenId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ mode: 'add' } | { mode: 'edit'; templateId: number; initial: TaskInput } | null>(null);
  const [fixOpen, setFixOpen] = useState(false);

  const statMap = useMemo(() => new Map((data?.stats ?? []).map((s) => [s.date, s])), [data?.stats]);

  if (!data) return <View style={{ flex: 1 }} />;
  if (!data.profile) return <Redirect href="/routines" />;

  const { tasks, profile, yTasks, activatedMins } = data;
  const doneCount = tasks.filter((t) => t.doneAt).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const yesterdayOpen = yTasks.filter((t) => !t.doneAt);
  const beforeSetup = (t: DayTask) => activatedMins != null && t.timeMinutes < activatedMins;
  const showSetupHint = activatedMins != null && data.hintDismissed !== today && tasks.some((t) => !t.doneAt && beforeSetup(t));

  const onToggle = async (t: DayTask) => {
    if (!t.doneAt && beforeSetup(t)) {
      const ok = await confirm({
        title: 'Mark as already done?',
        description: `“${t.title}” was scheduled before you set up this routine, so there was no reminder. Only mark it done if you really did it today.`,
        confirmText: 'Yes, I did it',
      });
      if (!ok) return;
    }
    await setDone(t.id, !t.doneAt);
  };

  const onEdit = async (t: DayTask) => {
    if (t.templateId == null) return;
    const tpl = await getTemplateTask(t.templateId);
    if (!tpl) return;
    setEditor({ mode: 'edit', templateId: tpl.id, initial: { title: tpl.title, timeMinutes: tpl.timeMinutes, notes: tpl.notes } });
  };

  const onDelete = async (t: DayTask) => {
    if (t.templateId == null) return;
    const ok = await confirm({
      title: 'Delete task?',
      description: `“${t.title}” will be removed from today and every ${weekdayName} in “${profile.name}”. Past days keep their history.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) await deleteTemplateTask(t.templateId);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} onScrollBeginDrag={() => setOpenId(null)}>
        <View style={styles.header}>
          <View style={{ gap: 4, flex: 1 }}>
            <Text variant="muted">{prettyDate(today)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Text variant="h1">Today</Text>
              <Badge label={profile.name} tone="outline" />
            </View>
          </View>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Settings" style={[styles.iconBtn, { borderColor: colors.border }]}>
            <Settings size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <WeekTracker week={weekKeys(today)} stats={statMap} today={today} streak={currentStreak(data.stats, today)} />

        {yesterdayOpen.length > 0 ? (
          <Card style={styles.banner}>
            <View style={{ flex: 1 }}>
              <Text variant="label">Yesterday has {yesterdayOpen.length} unfinished {yesterdayOpen.length === 1 ? 'task' : 'tasks'}</Text>
              <Text variant="muted">Forgot to tick something off? You can still fix yesterday.</Text>
            </View>
            <Button size="sm" variant="outline" title="Review" onPress={() => setFixOpen(true)} />
          </Card>
        ) : null}

        {showSetupHint ? (
          <Card style={[styles.banner, { backgroundColor: colors.muted, borderColor: colors.muted }]}>
            <Info size={18} color={colors.mutedForeground} />
            <Text variant="muted" style={{ flex: 1 }}>
              Tasks earlier than when you set up won’t send a reminder today. Swipe left on any you already did.
            </Text>
            <Pressable hitSlop={10} onPress={() => setSetting(SettingKeys.lastSetupHintDismissed, today)}>
              <X size={16} color={colors.mutedForeground} />
            </Pressable>
          </Card>
        ) : null}

        <View style={styles.listHeader}>
          <Text variant="h3">Tasks</Text>
          {tasks.length > 0 ? <Text variant="muted">{doneCount} of {tasks.length} done</Text> : null}
        </View>

        {tasks.length > 0 ? (
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.lit, width: `${(doneCount / tasks.length) * 100}%` }]} />
          </View>
        ) : null}

        {allDone ? (
          <Card style={[styles.banner, { borderColor: colors.lit, backgroundColor: colors.litSoft }]}>
            <CircleCheckBig size={22} color={colors.lit} />
            <View style={{ flex: 1 }}>
              <Text variant="label">Day lit up!</Text>
              <Text variant="muted">Everything’s cleared. Today shows up green on your calendar.</Text>
            </View>
          </Card>
        ) : null}

        {tasks.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: space(2), paddingVertical: space(8) }}>
            <Text variant="h3">Rest day</Text>
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Nothing is scheduled for {weekdayName}s. Rest days don’t break your streak.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: space(2.5) }}>
            {tasks.map((t) => (
              <SwipeTaskCard
                key={t.id}
                id={t.id}
                title={t.title}
                timeMinutes={t.timeMinutes}
                done={!!t.doneAt}
                badge={!t.doneAt && beforeSetup(t) ? 'Before setup' : undefined}
                isOpen={openId === t.id}
                onOpen={setOpenId}
                onClose={() => setOpenId((cur) => (cur === t.id ? null : cur))}
                onToggleDone={() => onToggle(t)}
                onEdit={() => onEdit(t)}
                onDelete={() => onDelete(t)}
              />
            ))}
            <Text variant="muted" style={{ textAlign: 'center', marginTop: space(1) }}>
              Swipe left to complete · swipe right to edit or delete
            </Text>
          </View>
        )}

        <Button variant="outline" title={`Add task to ${weekdayName}s`} icon={<Plus size={16} color={colors.foreground} />} onPress={() => setEditor({ mode: 'add' })} />
      </ScrollView>

      <TaskEditorSheet
        visible={!!editor}
        heading={editor?.mode === 'edit' ? 'Edit task' : 'New task'}
        subheading={editor?.mode === 'edit' ? `Changes apply to today and future ${weekdayName}s.` : `Added to every ${weekdayName} in “${profile.name}”.`}
        initial={editor?.mode === 'edit' ? editor.initial : null}
        onClose={() => setEditor(null)}
        onSave={async (input) => {
          if (editor?.mode === 'edit') await updateTemplateTask(editor.templateId, input);
          else await addTemplateTask(profile.id, weekdayOf(today), input);
        }}
      />

      <FixYesterdaySheet visible={fixOpen} date={yesterday} tasks={yTasks} onClose={() => setFixOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space(4), gap: space(4), paddingBottom: space(12) },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space(1) },
  progressTrack: { height: 6, borderRadius: radius.full, overflow: 'hidden', marginTop: -space(2) },
  progressFill: { height: '100%', borderRadius: radius.full },
});
