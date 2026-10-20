import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, getCurrentRole, type UserRole } from '@/lib/auth';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsByTeacher,
  closeEvent,
  reopenEvent,
  type CloudEvent,
} from '@/lib/events';
import {
  getTeacherEventAttendance,
  type TeacherEventAttendance,
  type AttendanceStatus,
} from '@/lib/attendance';
import { buildQRPayload } from '@/lib/qr';

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

type EditTarget = 'start' | 'end' | 'editStart' | 'editEnd';

// ============================================================
// SCREEN
// ============================================================

export default function TeacherScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // ----------------------------------------------------------
  // Create form
  // ----------------------------------------------------------

  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 2 * 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  // ----------------------------------------------------------
  // Data
  // ----------------------------------------------------------

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [attendance, setAttendance] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ----------------------------------------------------------
  // Inline editing of an existing event
  // ----------------------------------------------------------

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStart, setEditStart] = useState(() => new Date());
  const [editEnd, setEditEnd] = useState(() => new Date());
  const [savingEdit, setSavingEdit] = useState(false);

  const isAndroid = Platform.OS === 'android';

  // ----------------------------------------------------------
  // Quick-launch scrolling
  // Home passes ?section=create or ?section=events and this
  // screen scrolls to the matching block once data has loaded.
  // ----------------------------------------------------------

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const { section } = useLocalSearchParams<{ section?: string }>();

  useEffect(() => {
    if (!section || loading) return;

    const y = sectionY.current[section];

    if (y !== undefined) {
      scrollRef.current?.scrollTo({
        y: Math.max(y - 12, 0),
        animated: true,
      });
    }
  }, [section, loading]);

  // ----------------------------------------------------------
  // Load role, events and attendance
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

      if (currentRole === 'teacher' || currentRole === 'admin') {
        const [rows, att] = await Promise.all([
          getEventsByTeacher(user.id),
          getTeacherEventAttendance(user.id),
        ]);

        setEvents(rows);
        setAttendance(att);
      } else {
        setEvents([]);
        setAttendance([]);
      }
    } catch {
      setEvents([]);
      setAttendance([]);
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
  // Date / time picker
  // Both start and end pick a full date and time.
  // ----------------------------------------------------------

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setIsError(false);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!editTarget) return;

    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current =
      editTarget === 'start'
        ? startDate
        : editTarget === 'end'
          ? endDate
          : editTarget === 'editStart'
            ? editStart
            : editEnd;

    const next = new Date(current);
    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else if (editTarget === 'end') setEndDate(next);
    else if (editTarget === 'editStart') setEditStart(next);
    else setEditEnd(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  // ----------------------------------------------------------
  // Create event
  // ----------------------------------------------------------

  const handleCreateEvent = async () => {
    setMessage(null);
    setIsError(false);

    const cleanCode = eventCode.trim().toUpperCase();
    const cleanTitle = title.trim();

    if (!cleanCode || !cleanTitle) {
      setIsError(true);
      setMessage('Event title and event code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setIsError(true);
      setMessage('End time must be after the start time.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await createEvent({
        eventCode: cleanCode,
        title: cleanTitle,
        venue: venue.trim() || undefined,
        description: description.trim() || undefined,
        start: toLocalISO(startDate),
        end: toLocalISO(endDate),
      });

      if (error) {
        setIsError(true);
        setMessage(error);
        return;
      }

      setIsError(false);
      setMessage('Event created. Students can now scan its QR code.');

      setTitle('');
      setEventCode('');
      setVenue('');
      setDescription('');

      await loadAll();
    } catch {
      setIsError(true);
      setMessage('Could not save the event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // Edit an existing event
  // ----------------------------------------------------------

  const startEditing = (event: CloudEvent) => {
    setEditingId(event.id);
    setExpandedId(event.id);

    setEditTitle(event.title);
    setEditVenue(event.venue ?? '');
    setEditDescription(event.description ?? '');
    setEditStart(event.start_time ? new Date(event.start_time) : new Date());
    setEditEnd(
      event.end_time
        ? new Date(event.end_time)
        : new Date(Date.now() + 2 * 60 * 60 * 1000)
    );

    setMessage(null);
    setIsError(false);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTarget(null);
  };

  const handleSaveEdit = async (eventId: string) => {
    setMessage(null);
    setIsError(false);

    const cleanTitle = editTitle.trim();

    if (!cleanTitle) {
      Alert.alert('Invalid title', 'Event title cannot be empty.');
      return;
    }

    if (editEnd.getTime() <= editStart.getTime()) {
      Alert.alert('Invalid time', 'End time must be after the start time.');
      return;
    }

    setSavingEdit(true);

    try {
      const { error } = await updateEvent(eventId, {
        title: cleanTitle,
        venue: editVenue,
        description: editDescription,
        start: toLocalISO(editStart),
        end: toLocalISO(editEnd),
      });

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      setEditingId(null);
      await loadAll();
    } catch {
      Alert.alert('Error', 'Could not save your changes. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ----------------------------------------------------------
  // Close / reopen
  // ----------------------------------------------------------

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
              prev.map((e) =>
                e.id === event.id
                  ? { ...e, status: closing ? 'closed' : 'open' }
                  : e
              )
            );
          },
        },
      ]
    );
  };

  // ----------------------------------------------------------
  // Delete
  // ----------------------------------------------------------

  const handleDelete = (event: CloudEvent) => {
    const record = attendance.find((a) => a.eventId === event.id);
    const count = record?.attendeeCount ?? 0;

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

            setEvents((prev) => prev.filter((e) => e.id !== event.id));
            setAttendance((prev) =>
              prev.filter((a) => a.eventId !== event.id)
            );

            if (expandedId === event.id) setExpandedId(null);
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

  if (role !== 'teacher') {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.primary} />

        <Text style={styles.gateTitle}>Teachers Only</Text>

        <Text style={styles.gateSubtitle}>
          Only teacher accounts can manage events from this tab.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop:
            insets.top + (Platform.OS === 'android' ? 12 : 8) + 14,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Teacher</Text>

      {/* =====================================================
          CREATE FORM
      ====================================================== */}

      <View
        onLayout={(e) => {
          sectionY.current.create = e.nativeEvent.layout.y;
        }}
      >
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create an Event</Text>

          <Text style={styles.label}>Event Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter event title"
            placeholderTextColor={COLORS.textSecondary}
            editable={!saving}
          />

          <Text style={styles.label}>Event Code</Text>
          <TextInput
            style={styles.input}
            value={eventCode}
            onChangeText={setEventCode}
            placeholder="e.g. EVT-2026-0002"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
            editable={!saving}
          />

          <Text style={styles.label}>Venue</Text>
          <TextInput
            style={styles.input}
            value={venue}
            onChangeText={setVenue}
            placeholder="Enter venue"
            placeholderTextColor={COLORS.textSecondary}
            editable={!saving}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter event description"
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={3}
            editable={!saving}
          />

          {/* ---------------- START (date + time) ---------------- */}

          <Text style={styles.label}>Start</Text>
          <Pressable
            style={styles.pickerField}
            onPress={() => openPicker('start')}
          >
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.pickerValue}>
              {toDateField(startDate)} · {formatTime(startDate)}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={COLORS.textSecondary}
            />
          </Pressable>

          {/* ---------------- END (date + time) ---------------- */}

          <Text style={styles.label}>End</Text>
          <Pressable
            style={styles.pickerField}
            onPress={() => openPicker('end')}
          >
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.pickerValue}>
              {toDateField(endDate)} · {formatTime(endDate)}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={COLORS.textSecondary}
            />
          </Pressable>

          {editTarget === 'start' || editTarget === 'end' ? (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={editTarget === 'start' ? startDate : endDate}
                mode={isAndroid ? editingPart : 'datetime'}
                display={isAndroid ? 'default' : 'spinner'}
                onChange={onPickerChange}
              />
            </View>
          ) : null}

          {message && (
            <Text
              style={[
                styles.message,
                isError ? styles.messageError : styles.messageSuccess,
              ]}
            >
              {message}
            </Text>
          )}

          <AppButton
            theme="primary"
            title={saving ? 'Creating…' : 'Create Event'}
            icon="add-circle-outline"
            onPress={handleCreateEvent}
            disabled={saving}
          />
        </View>
      </View>

      {/* =====================================================
          YOUR EVENTS
      ====================================================== */}

      <View
        onLayout={(e) => {
          sectionY.current.events = e.nativeEvent.layout.y;
        }}
      >
        <Text style={styles.sectionTitle}>Your Events</Text>

        {loading ? (
          <View style={styles.inlineState}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.stateText}>Loading events…</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.inlineState}>
            <Ionicons
              name="calendar-outline"
              size={36}
              color={COLORS.textSecondary}
            />
            <Text style={styles.stateText}>
              You have not created any events yet.
            </Text>
          </View>
        ) : (
          events.map((event) => {
            const record = attendance.find((a) => a.eventId === event.id);
            const expanded = expandedId === event.id;
            const editing = editingId === event.id;
            const isOpen = event.status === 'open';
            const busy = busyId === event.id;

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
                    {record?.attendeeCount ?? 0}{' '}
                    {(record?.attendeeCount ?? 0) === 1
                      ? 'attendee'
                      : 'attendees'}
                  </Text>
                </View>

                {/* ---------------------------------------------
                    ACTIONS
                ---------------------------------------------- */}

                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => setExpandedId(expanded ? null : event.id)}
                  >
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'qr-code-outline'}
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text style={styles.actionText}>
                      {expanded ? 'Hide QR' : 'Show QR'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      editing ? cancelEditing() : startEditing(event)
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
                            isOpen ? 'lock-closed-outline' : 'lock-open-outline'
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

                {/* ---------------------------------------------
                    INLINE EDIT FORM
                ---------------------------------------------- */}

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
                      onPress={() => openPicker('editStart')}
                    >
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.pickerValue}>
                        {toDateField(editStart)} · {formatTime(editStart)}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={COLORS.textSecondary}
                      />
                    </Pressable>

                    <Text style={styles.label}>End</Text>
                    <Pressable
                      style={styles.pickerField}
                      onPress={() => openPicker('editEnd')}
                    >
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.pickerValue}>
                        {toDateField(editEnd)} · {formatTime(editEnd)}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={COLORS.textSecondary}
                      />
                    </Pressable>

                    {editTarget === 'editStart' || editTarget === 'editEnd' ? (
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

                    <AppButton
                      theme="primary"
                      title={savingEdit ? 'Saving…' : 'Save Changes'}
                      icon="checkmark-outline"
                      onPress={() => handleSaveEdit(event.id)}
                      disabled={savingEdit}
                    />
                  </View>
                )}

                {/* ---------------------------------------------
                    QR CODE
                ---------------------------------------------- */}

                {expanded && (
                  <View style={styles.qrSection}>
                    <Text style={styles.subSectionTitle}>Event QR Code</Text>

                    <View style={styles.qrBox}>
                      <QRCode
                        value={buildQRPayload({ eventId: event.event_code })}
                        size={200}
                      />
                    </View>

                    <Text style={styles.qrHint}>
                      Students scan this code with the Scan tab.
                    </Text>
                  </View>
                )}

                {/* ---------------------------------------------
                    ATTENDANCE RECORDS
                ---------------------------------------------- */}

                <View style={styles.recordsSection}>
                  <Text style={styles.subSectionTitle}>
                    Attendance Records
                  </Text>

                  {!record || record.attendees.length === 0 ? (
                    <Text style={styles.noAttendance}>
                      No students have scanned yet.
                    </Text>
                  ) : (
                    record.attendees.map((attendee) => (
                      <View
                        key={attendee.attendanceId}
                        style={styles.attendeeRow}
                      >
                        <View style={styles.attendeeInfo}>
                          <Text style={styles.studentName}>
                            {attendee.studentName ||
                              attendee.studentId.slice(-8)}
                          </Text>

                          <Text style={styles.studentMeta}>
                            {attendee.studentEmail || 'No email on file'}
                          </Text>
                        </View>

                        <View style={styles.attendeeRight}>
                          <Text style={styles.scanTime}>
                            {formatDateTime(attendee.scannedAt)}
                          </Text>

                          <View
                            style={[
                              styles.statusPill,
                              {
                                backgroundColor: statusColor(attendee.status),
                              },
                            ]}
                          >
                            <Text style={styles.statusPillText}>
                              {statusLabel(attendee.status)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 32,
  },

  inlineState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },

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

  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },

  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
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

  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

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

  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },

  message: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 4,
    lineHeight: 18,
  },

  messageSuccess: {
    color: COLORS.success,
  },

  messageError: {
    color: COLORS.danger,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },

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

  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  statusOpen: {
    backgroundColor: COLORS.success,
  },

  statusClosed: {
    backgroundColor: COLORS.warning,
  },

  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  countText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },

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

  qrSection: {
    marginTop: 16,
    alignItems: 'center',
  },

  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },

  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  qrHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },

  recordsSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },

  noAttendance: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  attendeeInfo: {
    flex: 1,
    paddingRight: 8,
  },

  attendeeRight: {
    alignItems: 'flex-end',
  },

  studentName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  studentMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  scanTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },

  statusPillText: {
    color: '#FFFFFF',
    fontSize: 10,
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
