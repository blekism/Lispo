/**
 * Bottom sheet for adding or editing a task (title, reminder time, notes).
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Bell } from 'lucide-react-native';
import { formatMinutes } from '../lib/dates';
import type { TaskInput } from '../db/repo';
import { radius, space, useTheme } from '../theme';
import { Button, Input, Text } from './ui';

export function TaskEditorSheet({
  visible,
  heading,
  subheading,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  heading: string;
  subheading?: string;
  initial?: TaskInput | null;
  onSave: (input: TaskInput) => Promise<void> | void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState(8 * 60);
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset the form only when the sheet opens, not on every parent re-render.
  const wasVisible = useRef(false);
  useEffect(() => {
    const opened = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (opened) {
      setTitle(initial?.title ?? '');
      setNotes(initial?.notes ?? '');
      setMinutes(initial?.timeMinutes ?? 8 * 60);
      setShowIosPicker(false);
    }
  }, [visible, initial]);

  const asDate = () => {
    const d = new Date();
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
  };

  const pickTime = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: asDate(),
        mode: 'time',
        is24Hour: false,
        onChange: (event, date) => {
          if (event.type === 'set' && date) setMinutes(date.getHours() * 60 + date.getMinutes());
        },
      });
    } else {
      setShowIosPicker((s) => !s);
    }
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), timeMinutes: minutes, notes: notes.trim() || null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text variant="h3">{heading}</Text>
          {subheading ? <Text variant="muted" style={{ marginTop: 2 }}>{subheading}</Text> : null}

          <View style={{ gap: space(4), marginTop: space(5) }}>
            <Input label="Task" placeholder="e.g. Read 10 pages" value={title} onChangeText={setTitle} autoFocus={!initial} returnKeyType="done" />

            <View style={{ gap: space(1.5) }}>
              <Text variant="label">Reminder time</Text>
              <Pressable onPress={pickTime} style={[styles.timeRow, { borderColor: colors.input }]}>
                <Bell size={16} color={colors.mutedForeground} />
                <Text style={{ flex: 1 }}>{formatMinutes(minutes)}</Text>
                <Text variant="muted">Change</Text>
              </Pressable>
              {showIosPicker ? (
                <DateTimePicker
                  value={asDate()}
                  mode="time"
                  display="spinner"
                  onChange={(_, date) => date && setMinutes(date.getHours() * 60 + date.getMinutes())}
                />
              ) : null}
            </View>

            <Input label="Notes (optional)" placeholder="Anything to remember" value={notes} onChangeText={setNotes} />
          </View>

          <View style={styles.actions}>
            <Button variant="outline" title="Cancel" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={save} loading={saving} disabled={!title.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: space(5),
    paddingBottom: space(8),
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space(4) },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
  },
  actions: { flexDirection: 'row', gap: space(2), marginTop: space(6) },
});
