import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFocusEffect, useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';

import { useAuth, signOut, type UserRole } from '@/lib/auth';

import { getProfile, updateProfile, type Profile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();

  const insets = useSafeAreaInsets();

  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [profileLoading, setProfileLoading] = useState(true);

  const [profileError, setProfileError] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');

  const [editing, setEditing] = useState(false);

  const [saving, setSaving] = useState(false);

  /**
   * Load the profile from Supabase on every focus.
   * An empty result is reported rather than silently
   * falling back to a default role.
   */
  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    try {
      const p = await getProfile(user.id);

      if (!p) {
        setProfile(null);
        setProfileError(
          'Could not load your profile. Your role may not be set yet.'
        );
        return;
      }

      setProfile(p);
      setDraftName(p.full_name ?? '');
    } catch {
      setProfile(null);
      setProfileError('Could not load your profile. Please pull to refresh.');
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  /**
   * Save the edited name.
   */
  const handleSaveName = async () => {
    if (!user) return;

    const cleanName = draftName.trim();

    if (!cleanName) {
      Alert.alert('Invalid Name', 'Please enter your name.');
      return;
    }

    setSaving(true);

    const { error } = await updateProfile(user.id, {
      full_name: cleanName,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setProfile((prev) =>
      prev ? { ...prev, full_name: cleanName } : prev
    );

    setDraftName(cleanName);
    setEditing(false);
  };

  /**
   * Sign out.
   */
  const handleSignOut = async () => {
    setLoading(true);

    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------
  // Role
  // ----------------------------------------------------------

  const role: UserRole | null =
    (profile?.role as UserRole | undefined) ?? null;

  const roleLabel =
    role === 'admin'
      ? 'Administrator'
      : role === 'teacher'
        ? 'Teacher'
        : role === 'student'
          ? 'Student'
          : 'Unknown';

  const roleStyle =
    role === 'admin'
      ? styles.roleBadgeAdmin
      : role === 'teacher'
        ? styles.roleBadgeTeacher
        : role === 'student'
          ? styles.roleBadgeStudent
          : styles.roleBadgeUnknown;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8) + 14,
        },
      ]}
    >
      <Text style={styles.title}>My Profile</Text>

      {user && (
        <View style={styles.infoCard}>
          {/* =========================
              ROLE BADGE
          ========================== */}

          {profileLoading ? (
            <View style={[styles.roleBadge, styles.roleBadgeUnknown]}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : (
            <View style={[styles.roleBadge, roleStyle]}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          )}

          {profileError && (
            <Text style={styles.warningText}>{profileError}</Text>
          )}

          {/* =========================
              NAME
          ========================== */}

          <Text style={styles.label}>Name</Text>

          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
                editable={!saving}
              />

              <Pressable
                style={styles.saveButton}
                onPress={handleSaveName}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditing(true)}
              style={styles.nameRow}
            >
              <Text style={styles.value}>
                {profile?.full_name || 'Tap to add your name'}
              </Text>

              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
          )}

          {/* =========================
              EMAIL
          ========================== */}

          <Text style={styles.label}>Email</Text>

          <Text style={styles.value}>{user.email}</Text>

          {/* =========================
              USER ID
          ========================== */}

          <Text style={styles.label}>User ID</Text>

          <Text style={styles.valueSmall}>{user.id}</Text>
        </View>
      )}

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },

  /* =========================
     ROLE BADGE
  ========================== */

  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
    minWidth: 60,
    alignItems: 'center',
  },

  roleBadgeAdmin: {
    backgroundColor: '#6A1B9A',
  },

  roleBadgeTeacher: {
    backgroundColor: COLORS.primary,
  },

  roleBadgeStudent: {
    backgroundColor: '#1565C0',
  },

  roleBadgeUnknown: {
    backgroundColor: COLORS.textSecondary,
  },

  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  warningText: {
    fontSize: 12,
    color: '#C62828',
    marginBottom: 4,
    lineHeight: 16,
  },

  /* =========================
     LABELS
  ========================== */

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },

  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  /* =========================
     NAME EDITING
  ========================== */

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  editHint: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },

  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  nameInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
