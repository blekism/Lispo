/**
 * Routine profiles. First launch lands here with a prompt to create one.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Layers, Plus, Sparkles } from 'lucide-react-native';
import { Profile, activateProfile, getActiveProfile, listProfiles } from '../../db/repo';
import { useQuery } from '../../hooks/useQuery';
import { syncNotifications } from '../../lib/notifications';
import { useConfirm } from '../../components/Dialog';
import { Badge, Button, Card, Text } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';

export default function RoutinesScreen() {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const { data: profiles } = useQuery(listProfiles);

  if (!profiles) return <View style={{ flex: 1 }} />;

  const enable = async (p: Profile) => {
    const active = await getActiveProfile();
    const ok = await confirm({
      title: `Switch to “${p.name}”?`,
      description: `${active ? `“${active.name}” will be turned off. ` : ''}Today’s list restarts with this routine’s tasks. Your calendar and streak carry over.`,
      confirmText: 'Switch',
    });
    if (!ok) return;
    await activateProfile(p.id);
    await syncNotifications();
    router.navigate('/today');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 4 }}>
          <Text variant="h1">Routines</Text>
          <Text variant="muted">Only one routine is active at a time.</Text>
        </View>

        {profiles.length === 0 ? (
          <Card style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.litSoft }]}>
              <Sparkles size={26} color={colors.lit} />
            </View>
            <Text variant="h3" style={{ textAlign: 'center' }}>Create your first routine</Text>
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Plan one week of tasks with reminder times. It repeats every week, and each day you clear everything lights up on your calendar.
            </Text>
            <Button title="Get started" size="lg" onPress={() => router.push('/profile/new')} style={{ alignSelf: 'stretch', marginTop: space(2) }} />
          </Card>
        ) : (
          <>
            {profiles.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/profile/${p.id}`)}>
                <Card style={[styles.row, p.isActive && { borderColor: colors.lit }]}>
                  <View style={[styles.icon, { backgroundColor: p.isActive ? colors.litSoft : colors.muted }]}>
                    <Layers size={18} color={p.isActive ? colors.lit : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                      <Text variant="large" numberOfLines={1} style={{ flexShrink: 1 }}>{p.name}</Text>
                      {p.isActive ? <Badge label="Active" tone="lit" /> : null}
                    </View>
                    <Text variant="muted">{p.taskCount} {p.taskCount === 1 ? 'task' : 'tasks'} per week</Text>
                  </View>
                  {p.isActive ? (
                    <ChevronRight size={18} color={colors.mutedForeground} />
                  ) : (
                    <Button size="sm" variant="outline" title="Enable" onPress={() => enable(p)} />
                  )}
                </Card>
              </Pressable>
            ))}
            <Button variant="secondary" title="New routine" icon={<Plus size={16} color={colors.foreground} />} onPress={() => router.push('/profile/new')} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), paddingBottom: space(12) },
  empty: { alignItems: 'center', gap: space(2), paddingVertical: space(8), marginTop: space(4) },
  emptyIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
