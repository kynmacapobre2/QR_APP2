import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';

import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';

import { getProfile } from '@/lib/profiles';

export default function HistoryScreen() {
  const [records, setRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [loading, setLoading] = useState(true);

  // PHASE 6: Teacher events
  const [teacherEvents, setTeacherEvents] =
    useState<TeacherEventAttendance[]>([]);

  const [role, setRole] = useState<
    'student' | 'teacher'
  >('student');

  const { user } = useAuth();

  const loadHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // PHASE 6:
    // Get the user's role from profiles
    const profile = await getProfile(user.id);

    const currentRole =
      profile?.role ?? 'student';

    setRole(currentRole);

    // ==========================================
    // TEACHER
    // ==========================================

    if (currentRole === 'teacher') {
      const events =
        await getTeacherEventAttendance(
          user.id
        );

      setTeacherEvents(events);

      // Clear student records
      setRecords([]);
    }

    // ==========================================
    // STUDENT
    // ==========================================

    else {
      // YOUR ORIGINAL PHASE 4 CODE
      const studentId = user.id;

      getAttendanceHistory(studentId).then(
        (rows) => {
          setRecords(rows);
        }
      );

      // Clear teacher events
      setTeacherEvents([]);
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Attendance History
      </Text>

      {loading ? (
        <Text style={styles.subtitle}>
          Loading records...
        </Text>
      ) : role === 'teacher' ? (

        // ==========================================
        // PHASE 6: TEACHER HISTORY
        // ==========================================

        teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            You have not created any events yet.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) =>
              String(item.eventId)
            }
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>

                {/* Event Title */}
                <Text style={styles.eventTitle}>
                  {item.title}
                </Text>

                {/* Attendee Count */}
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>
                    {item.attendeeCount}{' '}
                    {item.attendeeCount === 1
                      ? 'attendee'
                      : 'attendees'}
                  </Text>
                </View>

                {/* Event Code */}
                <Text style={styles.eventMeta}>
                  {item.eventCode}
                </Text>

                {/* Start Time */}
                <Text style={styles.eventMeta}>
                  Start:{' '}
                  {item.startTime
                    ? formatDate(
                        item.startTime
                      )
                    : 'Not set'}
                </Text>

                {/* Students */}
                <Text style={styles.studentsTitle}>
                  Students
                </Text>

                {item.attendees.length === 0 ? (
                  <Text style={styles.noAttendance}>
                    No students have scanned yet.
                  </Text>
                ) : (
                  item.attendees.map(
                    (attendee) => (
                      <View
                        key={`${item.eventId}-${attendee.studentId}-${attendee.scannedAt}`}
                        style={
                          styles.attendeeRow
                        }
                      >
                        <Text
                          style={styles.studentId}
                        >
                          {shortId(
                            attendee.studentId
                          )}
                        </Text>

                        <Text
                          style={styles.scanTime}
                        >
                          {formatDate(
                            attendee.scannedAt
                          )}
                        </Text>
                      </View>
                    )
                  )
                )}
              </View>
            )}
          />
        )

      ) : (

        // ==========================================
        // STUDENT HISTORY
        // YOUR ORIGINAL CODE IS KEPT
        // ==========================================

        records.length === 0 ? (
          <Text style={styles.subtitle}>
            No records yet. Scan a QR code to register your attendance.
          </Text>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) =>
              String(item.id)
            }
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.eventTitle}>
                  {item.eventTitle}
                </Text>

                <Text style={styles.eventMeta}>
                  {item.eventId}
                </Text>

                <Text style={styles.eventMeta}>
                  {formatDate(
                    item.scannedAt
                  )}
                </Text>
              </View>
            )}
          />
        )
      )}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

// PHASE 6:
// Show only the last 8 characters of the student UUID.
function shortId(id: string) {
  return id
    ? `…${id.slice(-8)}`
    : 'unknown';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
  },

  list: {
    paddingBottom: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ==========================================
  // PHASE 6: TEACHER STYLES
  // ==========================================

  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 8,
  },

  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  studentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },

  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 9,
  },

  studentId: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  scanTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  noAttendance: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
});