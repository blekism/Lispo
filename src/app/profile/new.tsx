/**
 * Guided routine setup: 1) name  2) tasks for each day of the week  3) reminders + start.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCircle2, Clock } from 'lucide-react-native';
import { activateProfile, createProfile, deleteProfile, getActiveProfile, listTemplateTasks, renameProfile } from '../../db/repo';
import { useQuery } from '../../hooks/useQuery';
import { MONTHS, WEEKDAYS_SHORT } from '../../lib/dates';
import { getPermissionState, requestExactAlarms, requestNotificationPermission, syncNotifications } from '../../lib/notifications';
import { WeekBuilder } from '../../components/WeekBuilder';
import { useConfirm } from '../../components/Dialog';
import { Button, Card, Chip, Input, Text } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';

type Step = 'name' | 'week' | 'finish';
const SUGGESTIONS = ['Weekday grind', 'Study mode', 'Healthy habits', 'Summer break'];

export default function NewProfileScreen() {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [profileId, setProfileId] = useState<number | null>(null);
  const finished = useRef(false);
  const idRef = useRef<number | null>(null);
  idRef.current = profileId;

  // Leaving the wizard before adding any task discards the empty draft.
  useEffect(
    () => () => {
      const id = idRef.current;
      if (!finished.current && id != null) {
        listTemplateTasks(id).then((t) => {
          if (t.length === 0) deleteProfile(id);
        });
      }
    },
    []
  );

  const { data: tasks = [] } = useQuery(async () => (profileId ? listTemplateTasks(profileId) : []), [profileId]);
  const { data: perms, reload: reloadPerms } = useQuery(getPermissionState);
  const { data: active } = useQuery(getActiveProfile);

  const stepIndex = { name: 0, week: 1, finish: 2 }[step];

  const nextFromName = async () => {
    if (!name.trim()) return;
    if (profileId) await renameProfile(profileId, name);
    else setProfileId(await createProfile(name));
    setStep('week');
  };

  const nextFromWeek = async () => {
    if (tasks.length === 0) {
      await confirm({ title: 'Add at least one task', description: 'Pick a day above and tap “Add task”. Days without tasks become rest days.', confirmText: 'OK', cancelText: null });
      return;
    }
    setStep('finish');
  };

  const finish = async (activate: boolean) => {
    if (!profileId) return;
    if (activate && active && active.id !== profileId) {
      const ok = await confirm({
        title: `Switch to “${name.trim()}”?`,
        description: `“${active.name}” will be turned off. Today’s list restarts with this routine’s tasks. Your calendar and streak carry over.`,
        confirmText: 'Switch',
      });
      if (!ok) return;
    }
    finished.current = true;
    if (activate) {
      await activateProfile(profileId);
      await syncNotifications();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/today');
    } else {
      router.back();
    }
  };

  const month = MONTHS[new Date().getMonth()];

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'New routine' }} />
      <View style={[styles.progress, { borderColor: colors.border }]}>
        {['Name', 'Week', 'Start'].map((label, i) => (
          <View key={label} style={{ flex: 1, gap: 6 }}>
            <View style={[styles.bar, { backgroundColor: i <= stepIndex ? colors.foreground : colors.muted }]} />
            <Text variant="muted" style={{ fontSize: 12, color: i <= stepIndex ? colors.foreground : colors.mutedForeground }}>
              {i + 1}. {label}
            </Text>
          </View>
        ))}
      </View>

      {step === 'name' ? (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text variant="h2">Name your routine</Text>
          <Text variant="muted">A routine is your plan for a normal week. You can make several (like “School” and “Vacation”) and switch between them, but only one is active at a time.</Text>
          <Input label="Routine name" placeholder="e.g. Weekday grind" value={name} onChangeText={setName} autoFocus onSubmitEditing={nextFromName} />
          <View style={styles.wrap}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onPress={() => setName(s)} />
            ))}
          </View>
        </ScrollView>
      ) : null}

      {step === 'week' && profileId ? (
        <View style={{ flex: 1 }}>
          <WeekBuilder
            profileId={profileId}
            header={
              <View style={{ gap: 4 }}>
                <Text variant="h2">Plan your week</Text>
                <Text variant="muted">
                  Add tasks for each day with the time you want a reminder. This week repeats every week, so it becomes your routine for {month} and beyond.
                </Text>
              </View>
            }
          />
        </View>
      ) : null}

      {step === 'finish' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text variant="h2">Ready to start</Text>
          <Text variant="muted">Tracking starts today. Tasks later today will remind you on time. Earlier ones won’t, but you can still mark them done if you did them.</Text>

          <Card style={{ gap: space(3) }}>
            <Text variant="label">{name.trim()}</Text>
            <View style={styles.weekSummary}>
              {WEEKDAYS_SHORT.map((d, i) => {
                const n = tasks.filter((t) => t.weekday === i).length;
                return (
                  <View key={d} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                    <Text variant="muted" style={{ fontSize: 12 }}>{d}</Text>
                    <View style={[styles.count, { backgroundColor: n ? colors.litSoft : colors.muted }]}>
                      <Text variant="label" style={{ color: n ? colors.lit : colors.mutedForeground }}>{n || '–'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          <PermissionRow
            icon={<Bell size={18} color={colors.foreground} />}
            title="Notifications"
            description="So Lispo can remind you when a task is due."
            granted={!!perms?.notifications}
            onPress={async () => {
              await requestNotificationPermission();
              reloadPerms();
            }}
          />
          <PermissionRow
            icon={<Clock size={18} color={colors.foreground} />}
            title="Exact timing"
            description="Lets reminders fire right on time instead of a few minutes late. Opens a system setting."
            granted={!!perms?.exactAlarms}
            onPress={async () => {
              await requestExactAlarms();
              reloadPerms();
            }}
          />
        </ScrollView>
      ) : null}

      <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {step !== 'name' ? (
          <Button variant="outline" title="Back" onPress={() => setStep(step === 'finish' ? 'week' : 'name')} style={{ flex: 1 }} />
        ) : null}
        {step === 'name' ? <Button title="Next" disabled={!name.trim()} onPress={nextFromName} style={{ flex: 1 }} /> : null}
        {step === 'week' ? <Button title="Next" onPress={nextFromWeek} style={{ flex: 1 }} /> : null}
        {step === 'finish' ? (
          active && active.id !== profileId ? (
            <>
              <Button variant="secondary" title="Save for later" onPress={() => finish(false)} style={{ flex: 1 }} />
              <Button title="Make active" onPress={() => finish(true)} style={{ flex: 1 }} />
            </>
          ) : (
            <Button title="Start routine" onPress={() => finish(true)} style={{ flex: 1 }} />
          )
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PermissionRow({ icon, title, description, granted, onPress }: { icon: React.ReactNode; title: string; description: string; granted: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.perm}>
      <View style={[styles.permIcon, { backgroundColor: colors.muted }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="label">{title}</Text>
        <Text variant="muted">{description}</Text>
      </View>
      {granted ? <CheckCircle2 size={22} color={colors.lit} /> : <Button size="sm" title="Allow" onPress={onPress} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(4), paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { height: 4, borderRadius: 2 },
  body: { padding: space(4), gap: space(4) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  footer: { flexDirection: 'row', gap: space(2), padding: space(4), borderTopWidth: StyleSheet.hairlineWidth },
  weekSummary: { flexDirection: 'row' },
  count: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  perm: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  permIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
