import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { getCurrentRole, useAuth, type UserRole } from '@/lib/auth';

export default function TabLayout() {
  const { user } = useAuth();

  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return () => {
        active = false;
      };
    }

    setRoleLoading(true);

    getCurrentRole()
      .then((r) => {
        if (active) setRole(r);
      })
      .catch(() => {
        if (active) setRole(null);
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  // Hold a spinner until the role is known, so the correct tabs
  // appear in one step instead of flickering between sets.
  if (roleLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';

  return (
    <Tabs
      screenOptions={{
        // Removes the title bar at the top of every tab. Each screen
        // supplies its own navy header instead.
        headerShown: false,

        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,

        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingTop: 4,
          height: 62,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      {/* Students only */}
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: isStudent ? '/scan' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'qr-code' : 'qr-code-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      {/* Teachers only */}
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: isTeacher ? '/teacher' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'clipboard' : 'clipboard-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      {/* Administrators only */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'shield' : 'shield-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={23}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
