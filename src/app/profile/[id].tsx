/**
 * Edit an existing routine: rename, edit its week, enable or delete it.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateProfile, deleteProfile, getActiveProfile, getProfile, renameProfile } from '../../db/repo';
import { useQuery } from '../../hooks/useQuery';
import { syncNotifications } from '../../lib/notifications';
import { todayKey, weekdayOf } from '../../lib/dates';
import { WeekBuilder } from '../../components/WeekBuilder';
import { useConfirm } from '../../components/Dialog';
import { Badge, Button, Input, Text } from '../../components/ui';
import { space, useTheme } from '../../theme';

export default function EditProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = Number(id);
  const { colors } = useTheme();
  const confirm = useConfirm();
  const { data } = useQuery(async () => ({ profile: await getProfile(profileId), active: await getActiveProfile() }), [profileId]);
  const [name, setName] = useState('');

  useEffect(() => {
    if (data?.profile) setName(data.profile.name);
  }, [data?.profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <View style={{ flex: 1 }} />;
  const { profile, active } = data;
  if (!profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="muted">This routine no longer exists.</Text>
      </View>
    );
  }

  const enable = async () => {
    const ok = await confirm({
      title: `Switch to “${profile.name}”?`,
      description: `${active ? `“${active.name}” will be turned off. ` : ''}Today’s list restarts with this routine’s tasks. Your calendar and streak carry over.`,
      confirmText: 'Switch',
    });
    if (!ok) return;
    await activateProfile(profile.id);
    await syncNotifications();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/today');
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete routine?',
      description: `“${profile.name}” and its weekly tasks will be deleted. Your calendar history stays.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteProfile(profile.id);
    router.back();
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: profile.name }} />
      <View style={{ flex: 1 }}>
        <WeekBuilder
          profileId={profile.id}
          initialWeekday={weekdayOf(todayKey())}
          header={
            <View style={{ gap: space(3) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                {profile.isActive ? <Badge label="Active" tone="lit" /> : <Badge label="Not active" tone="muted" />}
                <Text variant="muted">Edits apply to today and future days. Past days keep their history.</Text>
              </View>
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                onEndEditing={() => name.trim() && name.trim() !== profile.name && renameProfile(profile.id, name)}
              />
            </View>
          }
        />
      </View>
      {!profile.isActive ? (
        <View style={[styles.footer, { borderColor: colors.border }]}>
          <Button variant="outline" title="Delete" onPress={remove} style={{ flex: 1 }} textStyle={{ color: colors.destructive }} />
          <Button title="Enable routine" onPress={enable} style={{ flex: 2 }} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: space(2), padding: space(4), borderTopWidth: StyleSheet.hairlineWidth },
});
