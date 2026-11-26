/**
 * Entry route. With an active routine the app always opens on Today;
 * otherwise it opens on Routines, which prompts creating the first one.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { getActiveProfile } from '../db/repo';
import { useQuery } from '../hooks/useQuery';

export default function Index() {
  const { data } = useQuery(async () => ({ active: await getActiveProfile() }));
  if (!data) return <View style={{ flex: 1 }} />;
  return <Redirect href={data.active ? '/today' : '/routines'} />;
}
