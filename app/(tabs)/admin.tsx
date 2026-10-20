import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth, getCurrentRole, type UserRole } from '@/lib/auth';
import {
  getAllProfiles,
  updateUserRole,
  type Profile,
} from '@/lib/profiles';
import {
  getAllEvents,
  updateEvent,
  deleteEvent,
  closeEvent,
  reopenEvent,
  type CloudEvent,
} from '@/lib/events';
import {
  getAdminReport,
  type AdminReportRow,
  type AttendanceStatus,
} from '@/lib/attendance';

// ============================================================
// HELPERS
// ============================================================

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalISO(date: Date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function toDateField(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const month = date.toLocaleString('en-US', { month: 'short' });

  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} · ${formatTime(
    date
  )}`;
}

function statusLabel(status: AttendanceStatus) {
  switch (status) {
    case 'late':
      return 'Late';
    case 'excused':
      return 'Excused';
    case 'absent':
      return 'Absent';
    case 'corrected':
      return 'Corrected';
    default:
      return 'Present';
  }
}

function statusColor(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return COLORS.success;
    case 'late':
      return COLORS.warning;
    case 'excused':
      return COLORS.primary;
    case 'absent':
      return COLORS.danger;
    default:
      return COLORS.warning;
  }
}

const ROLES: UserRole[] = ['student', 'teacher', 'admin'];

type EditTarget = 'editStart' | 'editEnd';

// ============================================================
// SCREEN
// ============================================================

export default function AdminScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [section, setSection] = useState<'users' | 'events' | 'report'>(
    'users'
  );

  // Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [report, setReport] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Report filters
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Inline event editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStart, setEditStart] = useState(() => new Date());
  const [editEnd, setEditEnd] = useState(() => new Date());
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [savingEdit, setSavingEdit] = useState(false);

  const isAndroid = Platform.OS === 'android';

  // ----------------------------------------------------------
  // Quick-launch section
  // Home passes ?section=users|events|report and this screen
  // switches to that segment.
  // ----------------------------------------------------------

  const { section: requested } = useLocalSearchParams<{ section?: string }>();

  useEffect(() => {
    if (
      requested === 'users' ||
      requested === 'events' ||
      requested === 'report'
    ) {
      setSection(requested);
    }
  }, [requested]);

  // ----------------------------------------------------------
  // Load everything
  // ----------------------------------------------------------

  const loadAll = useCallback(async () => {
    if (!user) {
      setRoleLoading(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const currentRole = (await getCurrentRole()) ?? 'student';
      setRole(currentRole);

      if (currentRole === 'admin') {
        const [p, e, r] = await Promise.all([
          getAllProfiles(),
          getAllEvents(),
          getAdminReport(),
        ]);

        setProfiles(p);
        setEvents(e);
        setReport(r);
      } else {
        setProfiles([]);
        setEvents([]);
        setReport([]);
      }
    } catch {
      setProfiles([]);
      setEvents([]);
      setReport([]);
    } finally {
      setRoleLoading(false);
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  // ----------------------------------------------------------
  // Change a user's role
  // ----------------------------------------------------------

  const handleChangeRole = (profile: Profile, next: UserRole) => {
    if (profile.role === next) return;
    if (profile.id === user?.id) {
      Alert.alert(
        'Cannot change your own role',
        'Ask another administrator to change your role.'
      );
      return;
    }

    Alert.alert(
      'Change role?',
      `${profile.full_name || profile.email || 'This user'} will become ${
        next.charAt(0).toUpperCase() + next.slice(1)
      }.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBusyId(profile.id);

            const { error } = await updateUserRole(profile.id, next);

            setBusyId(null);

            if (error) {
              Alert.alert('Error', error);
              return;
            }

            setProfiles((prev) =>
              prev.map((p) => (p.id === profile.id ? { ...p, role: next } : p))
            );

            // Role changes affect the report's student set.
            const updated = await getAdminReport();
            setReport(updated);
          },
        },
      ]
    );
  };

  // ----------------------------------------------------------
  // Event editing
  // ----------------------------------------------------------

  const startEditing = (event: CloudEvent) => {
    setEditingId(event.id);
    setEditTitle(event.title);
    setEditVenue(event.venue ?? '');
    setEditDescription(event.description ?? '');
    setEditStart(event.start_time ? new Date(event.start_time) : new Date());
    setEditEnd(
      event.end_time
        ? new Date(event.end_time)
        : new Date(Date.now() + 2 * 60 * 60 * 1000)
    );
    setEditTarget(null);
  };

  const onPickerChange = (e: DateTimePickerEvent, selected?: Date) => {
    if (!editTarget) return;

    if (e.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'editStart' ? editStart : editEnd;
    const next = new Date(current);
    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'editStart') setEditStart(next);
    else setEditEnd(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleSaveEdit = async (eventId: string) => {
    if (!editTitle.trim()) {
      Alert.alert('Invalid title', 'Event title cannot be empty.');
      return;
    }

    if (editEnd.getTime() <= editStart.getTime()) {
      Alert.alert('Invalid time', 'End time must be after the start time.');
      return;
    }

    setSavingEdit(true);

    const { error } = await updateEvent(eventId, {
      title: editTitle,
      venue: editVenue,
      description: editDescription,
      start: toLocalISO(editStart),
      end: toLocalISO(editEnd),
    });

    setSavingEdit(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setEditingId(null);
    await loadAll();
  };

  const handleToggleStatus = (event: CloudEvent) => {
    const closing = event.status === 'open';

    Alert.alert(
      closing ? 'Close event?' : 'Reopen event?',
      closing
        ? `Students will no longer be able to record attendance for "${event.title}".`
        : `Students will be able to record attendance for "${event.title}" again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: closing ? 'Close Event' : 'Reopen Event',
          style: closing ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(event.id);

            const { error } = closing
              ? await closeEvent(event.id)
              : await reopenEvent(event.id);

            setBusyId(null);

            if (error) {
              Alert.alert('Error', error);
              return;
            }

            setEvents((prev) =>
              prev.map((x) =>
                x.id === event.id
                  ? { ...x, status: closing ? 'closed' : 'open' }
                  : x
              )
            );
          },
        },
      ]
    );
  };

  const handleDelete = (event: CloudEvent) => {
    const count = report.filter(
      (r) => r.eventId === event.id && r.scannedAt !== null
    ).length;

    Alert.alert(
      'Delete event?',
      count > 0
        ? `"${event.title}" and its ${count} attendance ${
            count === 1 ? 'record' : 'records'
          } will be permanently deleted. This cannot be undone.`
        : `"${event.title}" will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(event.id);

            const { error } = await deleteEvent(event.id);

            setBusyId(null);

            if (error) {
              Alert.alert('Error', error);
              return;
            }

            setEvents((prev) => prev.filter((x) => x.id !== event.id));
            setReport((prev) => prev.filter((r) => r.eventId !== event.id));
            if (editingId === event.id) setEditingId(null);
          },
        },
      ]
    );
  };

  // ----------------------------------------------------------
  // Gates
  // ----------------------------------------------------------

  if (roleLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.stateText}>Checking your account…</Text>
      </View>
    );
  }

  if (role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.primary} />

        <Text style={styles.gateTitle}>Administrators Only</Text>

        <Text style={styles.gateSubtitle}>
          Only administrator accounts can manage users and view system-wide
          reports.
        </Text>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Filtered report
  // ----------------------------------------------------------

  const filteredReport = report.filter((row) => {
    if (filterEvent !== 'all' && row.eventId !== filterEvent) return false;
    if (filterStatus !== 'all' && row.status !== filterStatus) return false;
    return true;
  });

  const statusCounts = {
    present: report.filter((r) => r.status === 'present').length,
    late: report.filter((r) => r.status === 'late').length,
    absent: report.filter((r) => r.status === 'absent').length,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8) + 14,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Admin Dashboard</Text>

      {/* =====================================================
          SECTION SWITCHER
      ====================================================== */}

      <View style={styles.segmented}>
        {(
          [
            { key: 'users', label: 'Users', icon: 'people-outline' },
            { key: 'events', label: 'Events', icon: 'calendar-outline' },
            { key: 'report', label: 'Report', icon: 'stats-chart-outline' },
          ] as const
        ).map((item) => {
          const active = section === item.key;

          return (
            <Pressable
              key={item.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setSection(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={active ? '#FFFFFF' : COLORS.textPrimary}
              />
              <Text
                style={[
                  styles.segmentText,
                  active && styles.segmentTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.inlineState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading data…</Text>
        </View>
      ) : section === 'users' ? (
        /* =====================================================
            USERS
        ====================================================== */

        <>
          <Text style={styles.sectionTitle}>
            Registered Users ({profiles.length})
          </Text>

          {profiles.length === 0 ? (
            <Text style={styles.stateText}>No registered users.</Text>
          ) : (
            profiles.map((profile) => (
              <View key={profile.id} style={styles.userCard}>
                <Text style={styles.userName}>
                  {profile.full_name || 'Unnamed user'}
                </Text>

                <Text style={styles.userEmail}>
                  {profile.email || 'No email on file'}
                </Text>

                <View style={styles.roleRow}>
                  {ROLES.map((r) => {
                    const active = profile.role === r;
                    const busy = busyId === profile.id;

                    return (
                      <Pressable
                        key={r}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                        onPress={() => handleChangeRole(profile, r)}
                        disabled={busy || active}
                      >
                        {busy && active ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text
                            style={[
                              styles.roleChipText,
                              active && styles.roleChipTextActive,
                            ]}
                          >
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </>
      ) : section === 'events' ? (
        /* =====================================================
            EVENTS
        ====================================================== */

        <>
          <Text style={styles.sectionTitle}>
            All Events ({events.length})
          </Text>

          {events.length === 0 ? (
            <Text style={styles.stateText}>No events have been created.</Text>
          ) : (
            events.map((event) => {
              const isOpen = event.status === 'open';
              const busy = busyId === event.id;
              const editing = editingId === event.id;

              const scanCount = report.filter(
                (r) => r.eventId === event.id && r.scannedAt !== null
              ).length;

              return (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventTop}>
                    <Text style={styles.eventTitle}>{event.title}</Text>

                    <View
                      style={[
                        styles.statusBadge,
                        isOpen ? styles.statusOpen : styles.statusClosed,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {isOpen ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.eventMeta}>{event.event_code}</Text>

                  <Text style={styles.eventMeta}>
                    {event.start_time
                      ? formatDateTime(event.start_time)
                      : 'Date not set'}
                  </Text>

                  {event.venue ? (
                    <Text style={styles.eventMeta}>{event.venue}</Text>
                  ) : null}

                  <View style={styles.countRow}>
                    <Ionicons
                      name="people-outline"
                      size={14}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.countText}>
                      {scanCount} {scanCount === 1 ? 'attendee' : 'attendees'}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() =>
                        editing
                          ? setEditingId(null)
                          : startEditing(event)
                      }
                    >
                      <Ionicons
                        name="create-outline"
                        size={16}
                        color={COLORS.primary}
                      />
                      <Text style={styles.actionText}>
                        {editing ? 'Cancel' : 'Edit'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.actionButton}
                      onPress={() => handleToggleStatus(event)}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <>
                          <Ionicons
                            name={
                              isOpen
                                ? 'lock-closed-outline'
                                : 'lock-open-outline'
                            }
                            size={16}
                            color={isOpen ? COLORS.danger : COLORS.success}
                          />
                          <Text
                            style={[
                              styles.actionText,
                              { color: isOpen ? COLORS.danger : COLORS.success },
                            ]}
                          >
                            {isOpen ? 'Close' : 'Reopen'}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      style={styles.actionButton}
                      onPress={() => handleDelete(event)}
                      disabled={busy}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={COLORS.danger}
                      />
                      <Text
                        style={[styles.actionText, { color: COLORS.danger }]}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </View>

                  {editing && (
                    <View style={styles.editPanel}>
                      <Text style={styles.subSectionTitle}>Edit Event</Text>

                      <Text style={styles.label}>Event Title</Text>
                      <TextInput
                        style={styles.input}
                        value={editTitle}
                        onChangeText={setEditTitle}
                        placeholder="Event title"
                        placeholderTextColor={COLORS.textSecondary}
                        editable={!savingEdit}
                      />

                      <Text style={styles.label}>Venue</Text>
                      <TextInput
                        style={styles.input}
                        value={editVenue}
                        onChangeText={setEditVenue}
                        placeholder="Venue"
                        placeholderTextColor={COLORS.textSecondary}
                        editable={!savingEdit}
                      />

                      <Text style={styles.label}>Description</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={editDescription}
                        onChangeText={setEditDescription}
                        placeholder="Description"
                        placeholderTextColor={COLORS.textSecondary}
                        multiline
                        numberOfLines={3}
                        editable={!savingEdit}
                      />

                      <Text style={styles.label}>Start</Text>
                      <Pressable
                        style={styles.pickerField}
                        onPress={() => {
                          setEditTarget('editStart');
                          setEditingPart('date');
                        }}
                      >
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={COLORS.primary}
                        />
                        <Text style={styles.pickerValue}>
                          {toDateField(editStart)} · {formatTime(editStart)}
                        </Text>
                      </Pressable>

                      <Text style={styles.label}>End</Text>
                      <Pressable
                        style={styles.pickerField}
                        onPress={() => {
                          setEditTarget('editEnd');
                          setEditingPart('date');
                        }}
                      >
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={COLORS.primary}
                        />
                        <Text style={styles.pickerValue}>
                          {toDateField(editEnd)} · {formatTime(editEnd)}
                        </Text>
                      </Pressable>

                      {editTarget ? (
                        <View style={styles.pickerContainer}>
                          <DateTimePicker
                            value={
                              editTarget === 'editStart' ? editStart : editEnd
                            }
                            mode={isAndroid ? editingPart : 'datetime'}
                            display={isAndroid ? 'default' : 'spinner'}
                            onChange={onPickerChange}
                          />
                        </View>
                      ) : null}

                      <Pressable
                        style={styles.saveButton}
                        onPress={() => handleSaveEdit(event.id)}
                        disabled={savingEdit}
                      >
                        <Text style={styles.saveButtonText}>
                          {savingEdit ? 'Saving…' : 'Save Changes'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      ) : (
        /* =====================================================
            ATTENDANCE REPORT
        ====================================================== */

        <>
          <Text style={styles.sectionTitle}>Attendance Report</Text>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderColor: COLORS.success }]}>
              <Text style={styles.summaryNumber}>{statusCounts.present}</Text>
              <Text style={styles.summaryLabel}>Present</Text>
            </View>

            <View style={[styles.summaryCard, { borderColor: COLORS.warning }]}>
              <Text style={styles.summaryNumber}>{statusCounts.late}</Text>
              <Text style={styles.summaryLabel}>Late</Text>
            </View>

            <View style={[styles.summaryCard, { borderColor: COLORS.danger }]}>
              <Text style={styles.summaryNumber}>{statusCounts.absent}</Text>
              <Text style={styles.summaryLabel}>Absent</Text>
            </View>
          </View>

          {/* Event filter */}
          <Text style={styles.filterLabel}>Filter by event</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            <Pressable
              style={[
                styles.filterChip,
                filterEvent === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setFilterEvent('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterEvent === 'all' && styles.filterChipTextActive,
                ]}
              >
                All events
              </Text>
            </Pressable>

            {events.map((event) => (
              <Pressable
                key={event.id}
                style={[
                  styles.filterChip,
                  filterEvent === event.id && styles.filterChipActive,
                ]}
                onPress={() => setFilterEvent(event.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterEvent === event.id && styles.filterChipTextActive,
                  ]}
                >
                  {event.event_code}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Status filter */}
          <Text style={styles.filterLabel}>Filter by status</Text>
          <View style={styles.filterRow}>
            {['all', 'present', 'late', 'excused', 'absent'].map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.filterChip,
                  filterStatus === s && styles.filterChipActive,
                ]}
                onPress={() => setFilterStatus(s)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterStatus === s && styles.filterChipTextActive,
                  ]}
                >
                  {s === 'all'
                    ? 'All'
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.reportCount}>
            {filteredReport.length}{' '}
            {filteredReport.length === 1 ? 'row' : 'rows'}
          </Text>

          {filteredReport.length === 0 ? (
            <Text style={styles.stateText}>No records match your filters.</Text>
          ) : (
            filteredReport.map((row) => (
              <View key={row.key} style={styles.reportCard}>
                <View style={styles.reportTop}>
                  <Text style={styles.userName}>
                    {row.studentName ||
                      row.studentEmail ||
                      row.studentId.slice(-8)}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor(row.status) },
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {statusLabel(row.status)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.eventMeta}>
                  {row.eventTitle} · {row.eventCode}
                </Text>

                <Text style={styles.eventMeta}>
                  {row.scannedAt
                    ? `Scanned ${formatDateTime(row.scannedAt)}`
                    : 'No scan recorded'}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  content: { paddingHorizontal: 20, paddingBottom: 40 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 32,
  },

  inlineState: { alignItems: 'center', paddingVertical: 40 },

  stateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },

  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },

  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },

  segmentActive: { backgroundColor: COLORS.primary },

  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 6,
  },

  segmentTextActive: { color: '#FFFFFF' },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },

  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },

  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  textArea: { minHeight: 80, textAlignVertical: 'top' },

  pickerField: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  pickerValue: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginLeft: 10,
  },

  pickerContainer: { marginTop: 12, alignItems: 'center' },

  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    paddingRight: 8,
  },

  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  roleRow: { flexDirection: 'row', marginTop: 12 },

  roleChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    marginRight: 8,
  },

  roleChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  roleChipTextActive: { color: '#FFFFFF' },

  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  eventTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingRight: 8,
  },

  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },

  statusOpen: { backgroundColor: COLORS.success },

  statusClosed: { backgroundColor: COLORS.warning },

  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  eventMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  countRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  countText: { fontSize: 13, color: COLORS.textSecondary, marginLeft: 6 },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
    marginBottom: 6,
    paddingVertical: 4,
  },

  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
  },

  editPanel: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  summaryRow: { flexDirection: 'row', marginBottom: 16 },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
  },

  summaryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 8,
  },

  filterScroll: { marginBottom: 4 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },

  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },

  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  filterChipTextActive: { color: '#FFFFFF' },

  reportCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },

  reportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  reportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  statusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  gateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },

  gateSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
