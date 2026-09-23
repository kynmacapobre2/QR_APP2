import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { initializeAuth, useAuth } from '@/lib/auth';

export default function RootLayout() {
  const { session } = useAuth();

  const segments = useSegments();

  useEffect(() => {
    initializeAuth();
  }, []);

  const path = segments?.[0];

  const inAuthGroup =
    path === 'login' ||
    path === 'register';

  // ============================================================
  // NOT LOGGED IN
  // Only Login and Register are allowed.
  // ============================================================

  if (!session && !inAuthGroup) {
    return <Redirect href="/login" />;
  }

  // ============================================================
  // LOGGED IN
  // Prevent logged-in users from staying on Login/Register.
  // ============================================================

  if (session && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />

      <Stack.Screen name="register" />

      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}