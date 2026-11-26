/**
 * Root layout: providers, database boot, and app-wide side effects
 * (day rollover, notification sync, notification action handling).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../db/client';
import { ensureDays } from '../db/repo';
import { emitChange, onChange } from '../lib/events';
import { todayKey } from '../lib/dates';
import { configureNotifications, handleNotificationResponse, syncNotifications } from '../lib/notifications';
import { registerBackgroundTask } from '../lib/backgroundTask';
import { DialogProvider } from '../components/Dialog';
import { useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const [ready, setReady] = useState(false);
  const dayRef = useRef(todayKey());

  // Boot: open DB (runs migrations), fill in days, set up notifications.
  useEffect(() => {
    (async () => {
      try {
        await getDb();
        await ensureDays();
        await configureNotifications();
        await registerBackgroundTask();
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
      syncNotifications();
    })();
  }, []);

  // Re-sync reminders after any data change (debounced so a burst of writes = one sync).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onChange(() => {
      clearTimeout(t);
      t = setTimeout(() => syncNotifications(), 600);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);

  // Coming back to the app, or midnight passing while it's open, starts a new day.
  useEffect(() => {
    const checkDay = async () => {
      const now = todayKey();
      await ensureDays(now);
      if (now !== dayRef.current) {
        dayRef.current = now;
        emitChange();
      }
    };
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        checkDay();
        syncNotifications();
      }
    });
    const timer = setInterval(checkDay, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  // "Mark done" pressed while the app is in the foreground.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      handleNotificationResponse(r).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.background,
      text: colors.foreground,
      border: colors.border,
      primary: colors.foreground,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <DialogProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            {ready ? (
              <Stack screenOptions={{ headerShadowVisible: false, contentStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="profile/new" options={{ title: 'New routine' }} />
                <Stack.Screen name="profile/[id]" options={{ title: 'Edit routine' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              </Stack>
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.background }} />
            )}
          </DialogProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
