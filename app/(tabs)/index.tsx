import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth, getCurrentRole, type UserRole } from '@/lib/auth';
import { getProfile, type Profile } from '@/lib/profiles';

export default function Index() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) return;

      getProfile(user.id).then((p) => {
        if (active) setProfile(p);
      });

      getCurrentRole().then((r) => {
        if (active) setRole(r);
      });

      return () => {
        active = false;
      };
    }, [user])
  );

  const roleLabel =
    role === 'admin'
      ? 'Administrator'
      : role === 'teacher'
        ? 'Teacher'
        : role === 'student'
          ? 'Student'
          : '';

  const initials = (profile?.full_name || user?.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  const headerTopPadding =
    insets.top + (Platform.OS === 'android' ? 12 : 8) + 14;

  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';

  return (
    <View style={styles.screen}>
      {/* =====================================================
          NAVY HEADER
      ====================================================== */}

      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <View style={styles.headerTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {profile?.full_name || 'QR Attendance'}
            </Text>

            <Text style={styles.headerSub} numberOfLines={1}>
              {user?.email || 'Not signed in'}
            </Text>

            {roleLabel ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{roleLabel}</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            style={styles.settingsButton}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
            <Text style={styles.settingsText}>Settings</Text>
          </Pressable>
        </View>
      </View>

      {/* =====================================================
          BODY
      ====================================================== */}

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- STUDENT ---------------- */}

        {!isTeacher && !isAdmin && (
          <>
            <Text style={styles.pageTitle}>School Event Attendance</Text>
            <Text style={styles.pageSubtitle}>
              Scan an event QR code to record your attendance.
            </Text>

            <Pressable
              style={styles.primaryAction}
              onPress={() => router.push('/scan')}
            >
              <View style={styles.primaryIcon}>
                <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
              </View>

              <View style={styles.primaryTextWrap}>
                <Text style={styles.primaryTitle}>Scan QR Code</Text>
                <Text style={styles.primarySub}>
                  Record your attendance at an event
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.sectionLabel}>Quick Access</Text>

            <View style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={() => router.push('/history')}
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Attendance History</Text>
                  <Text style={styles.rowSub}>
                    Your past attendance records
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.row}
                onPress={() => router.push('/profile')}
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>My Profile</Text>
                  <Text style={styles.rowSub}>Name, email and account</Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>How It Works</Text>

            <View style={styles.card}>
              <Step
                number="1"
                title="Find an event"
                text="Your teacher creates the event and shows its QR code."
              />

              <View style={styles.divider} />

              <Step
                number="2"
                title="Scan the code"
                text="Open the Scan tab and point your camera at the QR code."
              />

              <View style={styles.divider} />

              <Step
                number="3"
                title="Get confirmed"
                text="The system records your attendance and confirms it on screen."
              />
            </View>
          </>
        )}

        {/* ---------------- TEACHER ---------------- */}

        {isTeacher && (
          <>
            <Text style={styles.pageTitle}>Teacher Tools</Text>
            <Text style={styles.pageSubtitle}>
              Create events and manage the attendance they collect.
            </Text>

            <Text style={styles.sectionLabel}>Quick Launch</Text>

            <View style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/teacher',
                    params: { section: 'create' },
                  })
                }
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Create Event</Text>
                  <Text style={styles.rowSub}>
                    Make a new event and its QR code
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/teacher',
                    params: { section: 'events' },
                  })
                }
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="clipboard-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>My Events</Text>
                  <Text style={styles.rowSub}>
                    Edit, close, delete and view records
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Also Available</Text>

            <View style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={() => router.push('/profile')}
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>My Profile</Text>
                  <Text style={styles.rowSub}>Name, email and account</Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>
          </>
        )}

        {/* ---------------- ADMIN ---------------- */}

        {isAdmin && (
          <>
            <Text style={styles.pageTitle}>System Management</Text>
            <Text style={styles.pageSubtitle}>
              Users, events and attendance across the whole school.
            </Text>

            <Text style={styles.sectionLabel}>Quick Launch</Text>

            <View style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/admin',
                    params: { section: 'users' },
                  })
                }
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Users</Text>
                  <Text style={styles.rowSub}>
                    View accounts and set their roles
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/admin',
                    params: { section: 'events' },
                  })
                }
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Events</Text>
                  <Text style={styles.rowSub}>
                    Edit, close or delete any event
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/admin',
                    params: { section: 'report' },
                  })
                }
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="stats-chart-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Attendance Report</Text>
                  <Text style={styles.rowSub}>
                    Present, late and absent across all events
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Also Available</Text>

            <View style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={() => router.push('/profile')}
              >
                <View style={[styles.rowIcon, styles.rowIconBlue]}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>My Profile</Text>
                  <Text style={styles.rowSub}>Name, email and account</Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// STEP
// ============================================================

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* ---------------- HEADER ---------------- */

  header: {
    backgroundColor: COLORS.navy,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#7FA9E8',
  },

  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
  },

  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },

  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textOnNavy,
  },

  headerSub: {
    fontSize: 11,
    color: COLORS.textOnNavyMuted,
    marginTop: 2,
  },

  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navyDark,
    borderWidth: 1,
    borderColor: '#3D5A9E',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 5,
  },

  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textOnNavy,
    letterSpacing: 0.4,
  },

  settingsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10,
  },

  settingsText: {
    fontSize: 10,
    color: COLORS.textOnNavy,
    marginTop: 3,
  },

  /* ---------------- BODY ---------------- */

  body: {
    flex: 1,
  },

  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 32,
  },

  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  pageSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 20,
  },

  /* ---------------- PRIMARY ACTION ---------------- */

  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },

  primaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  primaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },

  primarySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  /* ---------------- SECTION LABEL ---------------- */

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  /* ---------------- CARD ---------------- */

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowIconBlue: {
    backgroundColor: COLORS.primaryLight,
  },

  rowText: {
    flex: 1,
    marginLeft: 12,
  },

  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  rowSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 62,
  },

  /* ---------------- STEPS ---------------- */

  stepRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  stepText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
});
