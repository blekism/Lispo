/**
 * Settings: follow-up reminder, permissions, backup/restore.
 */
import React from 'react';
import { Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { CheckCircle2, Download, Upload } from 'lucide-react-native';
import { SettingKeys, getFollowupConfig, setSetting } from '../db/repo';
import { useQuery } from '../hooks/useQuery';
import { getPermissionState, requestExactAlarms, requestNotificationPermission, syncNotifications } from '../lib/notifications';
import { pickAndRestoreBackup, shareBackup } from '../lib/backup';
import { useConfirm } from '../components/Dialog';
import { Button, Card, Chip, Separator, Text } from '../components/ui';
import { space, useTheme } from '../theme';

const DELAYS = [10, 15, 30, 60, 120];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const { data: followup } = useQuery(getFollowupConfig);
  const { data: perms, reload } = useQuery(getPermissionState);

  const label = (m: number) => (m < 60 ? `${m} min` : `${m / 60} hr`);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section title="Reminders">
        <Card style={{ gap: space(4) }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text variant="label">Follow-up reminder</Text>
              <Text variant="muted">If a task isn’t done yet, remind once more.</Text>
            </View>
            <Switch
              value={followup?.enabled ?? true}
              onValueChange={(v) => setSetting(SettingKeys.followupEnabled, v ? '1' : '0')}
              trackColor={{ true: colors.lit, false: colors.input }}
              thumbColor="#ffffff"
            />
          </View>
          {followup?.enabled ? (
            <View style={{ gap: space(2) }}>
              <Text variant="muted">Remind again after</Text>
              <View style={styles.wrap}>
                {DELAYS.map((m) => (
                  <Chip key={m} label={label(m)} selected={followup.minutes === m} onPress={() => setSetting(SettingKeys.followupMinutes, String(m))} />
                ))}
              </View>
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="Permissions">
        <Card style={{ gap: space(3) }}>
          <PermRow
            title="Notifications"
            granted={!!perms?.notifications}
            onFix={async () => {
              const ok = await requestNotificationPermission();
              if (!ok) Linking.openSettings();
              reload();
              syncNotifications();
            }}
          />
          <Separator />
          <PermRow
            title="Exact timing (alarms & reminders)"
            granted={!!perms?.exactAlarms}
            onFix={async () => {
              await requestExactAlarms();
              reload();
              syncNotifications();
            }}
          />
          <Text variant="muted">
            Tip: if reminders still arrive late, set Lispo’s battery usage to “Unrestricted” in your phone’s app settings.
          </Text>
          <Button variant="outline" size="sm" title="Open app settings" onPress={() => Linking.openSettings()} style={{ alignSelf: 'flex-start' }} />
        </Card>
      </Section>

      <Section title="Backup">
        <Card style={{ gap: space(3) }}>
          <Text variant="muted">Your data lives only on this phone. Export a backup before switching phones or reinstalling.</Text>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Button
              variant="outline"
              title="Export"
              icon={<Upload size={16} color={colors.foreground} />}
              style={{ flex: 1 }}
              onPress={() => shareBackup().catch((e) => confirm({ title: 'Export failed', description: String(e?.message ?? e), cancelText: null, confirmText: 'OK' }))}
            />
            <Button
              variant="outline"
              title="Import"
              icon={<Download size={16} color={colors.foreground} />}
              style={{ flex: 1 }}
              onPress={async () => {
                const ok = await confirm({
                  title: 'Replace all data?',
                  description: 'Importing a backup replaces every routine, task and calendar day on this phone.',
                  confirmText: 'Choose file',
                  destructive: true,
                });
                if (!ok) return;
                try {
                  if (await pickAndRestoreBackup()) {
                    await syncNotifications();
                    await confirm({ title: 'Backup restored', confirmText: 'OK', cancelText: null });
                  }
                } catch (e: any) {
                  await confirm({ title: 'Import failed', description: String(e?.message ?? e), confirmText: 'OK', cancelText: null });
                }
              }}
            />
          </View>
        </Card>
      </Section>

      <Text variant="muted" style={{ textAlign: 'center' }}>Lispo {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      <Text variant="label" style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 }}>{title}</Text>
      {children}
    </View>
  );
}

function PermRow({ title, granted, onFix }: { title: string; granted: boolean; onFix: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="label" style={{ flex: 1 }}>{title}</Text>
      {granted ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={16} color={colors.lit} />
          <Text variant="muted">Allowed</Text>
        </View>
      ) : (
        <Button size="sm" title="Allow" onPress={onFix} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(6), paddingBottom: space(12) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
