/**
 * shadcn-style AlertDialog. Use the promise API anywhere under <DialogProvider>:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete task?', destructive: true })) { ... }
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../theme';
import { Button, Text } from './ui';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string | null; // null hides the cancel button (info dialog)
  destructive?: boolean;
};

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export const useConfirm = () => useContext(ConfirmContext);

export function DialogShell({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.dialog, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DialogShell visible={!!opts} onClose={() => close(false)}>
        {opts ? (
          <>
            <Text variant="h3">{opts.title}</Text>
            {opts.description ? <Text variant="muted" style={{ marginTop: space(2), fontSize: 14, lineHeight: 20 }}>{opts.description}</Text> : null}
            <View style={styles.actions}>
              {opts.cancelText !== null ? <Button variant="outline" title={opts.cancelText ?? 'Cancel'} onPress={() => close(false)} /> : null}
              <Button variant={opts.destructive ? 'destructive' : 'default'} title={opts.confirmText ?? 'Continue'} onPress={() => close(true)} />
            </View>
          </>
        ) : null}
      </DialogShell>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6) },
  dialog: { width: '100%', maxWidth: 420, borderRadius: radius.lg, borderWidth: 1, padding: space(5) },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(2), marginTop: space(5) },
});
