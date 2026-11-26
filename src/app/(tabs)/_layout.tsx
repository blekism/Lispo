import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { CalendarDays, Layers, ListChecks } from 'lucide-react-native';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: ({ color, size }) => <Layers color={color} size={size} /> }} />
    </Tabs>
  );
}
