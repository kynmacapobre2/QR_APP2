import { supabase } from './supabase';
import { parseQRPayload } from './qr';

// ============================================================
// ATTENDANCE TYPES
// ============================================================

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'excused'
  | 'absent'
  | 'corrected';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

// ============================================================
// TEACHER TYPES
// ============================================================

export type TeacherAttendee = {
  attendanceId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  scannedAt: string;
  status: AttendanceStatus;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  status: 'open' | 'closed';
  attendeeCount: number;
  attendees: TeacherAttendee[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  status: 'open' | 'closed';
  attendeeCount: number;
};

// ============================================================
// ADMIN TYPES
// ============================================================

export type AdminAttendanceRecord = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  eventId: string;
  eventCode: string;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
  correctedAt: string | null;
};

export type AdminReportRow = {
  key: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  eventId: string;
  eventCode: string;
  eventTitle: string;
  scannedAt: string | null;
  status: AttendanceStatus;
};

// ============================================================
// REGISTER ATTENDANCE
// ------------------------------------------------------------
// All validation happens inside record_attendance() in the
// database: the student comes from the session, the role is
// checked, the event must exist and be OPEN, the time window is
// enforced, and the unique constraint blocks duplicates.
// ============================================================

export async function registerAttendance(
  rawPayload: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: parsed.message,
    };
  }

  const { data, error } = await supabase.rpc('record_attendance', {
    p_event_code: parsed.payload.event,
  });

  if (error) {
    return {
      success: false,
      message: 'Could not reach the server. Please try again.',
    };
  }

  const result = data as RegisterResult | null;

  if (!result) {
    return {
      success: false,
      message: 'Unexpected response from the server.',
    };
  }

  return {
    success: Boolean(result.success),
    message: result.message,
    eventTitle: result.eventTitle,
  };
}

// ============================================================
// GET STUDENT ATTENDANCE HISTORY
// ============================================================

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, status, events ( event_code, title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row: any): AttendanceRecord => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
    status: (row.status as AttendanceStatus) ?? 'present',
  }));
}

// ============================================================
// GET TEACHER EVENT ATTENDANCE
// ============================================================

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, status')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((event: any) => event.id);

  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('id, student_id, scanned_at, status, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attendanceError || !attendance || attendance.length === 0) {
    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      status: (event.status as 'open' | 'closed') ?? 'open',
      attendeeCount: 0,
      attendees: [],
    }));
  }

  const studentIds = Array.from(
    new Set(attendance.map((row: any) => row.student_id))
  );

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds);

  const profileMap: Record<
    string,
    { full_name: string | null; email: string | null }
  > = {};

  (profiles ?? []).forEach((p: any) => {
    profileMap[p.id] = {
      full_name: p.full_name,
      email: p.email,
    };
  });

  return events.map((event: any) => {
    const rows = attendance.filter((row: any) => row.event_id === event.id);

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      status: (event.status as 'open' | 'closed') ?? 'open',

      attendeeCount: rows.length,

      attendees: rows.map(
        (row: any): TeacherAttendee => ({
          attendanceId: row.id,
          studentId: row.student_id,
          studentName: profileMap[row.student_id]?.full_name ?? null,
          studentEmail: profileMap[row.student_id]?.email ?? null,
          scannedAt: row.scanned_at,
          status: (row.status as AttendanceStatus) ?? 'present',
        })
      ),
    };
  });
}

// ============================================================
// GET TEACHER EVENT SUMMARY
// ============================================================

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, status')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((event: any) => event.id);

  const { data: attRows, error: attError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    return [];
  }

  const counts: Record<string, number> = {};

  attRows.forEach((row: any) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    status: (event.status as 'open' | 'closed') ?? 'open',
    attendeeCount: counts[event.id] ?? 0,
  }));
}

// ============================================================
// ADMIN — SYSTEM-WIDE ATTENDANCE (recorded rows only)
// ============================================================

export async function getAdminAttendance(): Promise<
  AdminAttendanceRecord[]
> {
  const { data, error } = await supabase
    .from('attendance')
    .select(
      'id, student_id, scanned_at, status, corrected_at, event_id, events ( event_code, title )'
    )
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const studentIds = Array.from(
    new Set(data.map((row: any) => row.student_id))
  );

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds);

  const profileMap: Record<
    string,
    { full_name: string | null; email: string | null }
  > = {};

  (profiles ?? []).forEach((p: any) => {
    profileMap[p.id] = {
      full_name: p.full_name,
      email: p.email,
    };
  });

  return data.map((row: any): AdminAttendanceRecord => ({
    id: row.id,
    studentId: row.student_id,
    studentName: profileMap[row.student_id]?.full_name ?? null,
    studentEmail: profileMap[row.student_id]?.email ?? null,
    eventId: row.event_id,
    eventCode: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
    status: (row.status as AttendanceStatus) ?? 'present',
    correctedAt: row.corrected_at ?? null,
  }));
}

// ============================================================
// ADMIN — FULL REPORT
// One row per student per event. Students who never scanned
// appear as 'absent', because the events table is the spine.
// ============================================================

export async function getAdminReport(): Promise<AdminReportRow[]> {
  const { data: students, error: studentError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('role', 'student')
    .order('full_name', { ascending: true });

  if (studentError || !students) {
    return [];
  }

  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .order('created_at', { ascending: false });

  if (eventError || !events) {
    return [];
  }

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('id, student_id, event_id, scanned_at, status');

  if (attError || !attendance) {
    return [];
  }

  const scanMap: Record<
    string,
    { scannedAt: string; status: AttendanceStatus }
  > = {};

  attendance.forEach((row: any) => {
    scanMap[`${row.student_id}:${row.event_id}`] = {
      scannedAt: row.scanned_at,
      status: (row.status as AttendanceStatus) ?? 'present',
    };
  });

  const rows: AdminReportRow[] = [];

  students.forEach((student: any) => {
    events.forEach((event: any) => {
      const key = `${student.id}:${event.id}`;
      const scan = scanMap[key];

      rows.push({
        key,
        studentId: student.id,
        studentName: student.full_name ?? null,
        studentEmail: student.email ?? null,
        eventId: event.id,
        eventCode: event.event_code,
        eventTitle: event.title,
        scannedAt: scan?.scannedAt ?? null,
        status: scan ? scan.status : 'absent',
      });
    });
  });

  return rows;
}

// ============================================================
// ADMIN — CORRECT AN ATTENDANCE RECORD
// ============================================================

export async function correctAttendance(
  attendanceId: string,
  status: AttendanceStatus
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('correct_attendance', {
    p_attendance_id: attendanceId,
    p_status: status,
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as { success: boolean; message: string } | null;

  if (!result?.success) {
    return { error: result?.message ?? 'Could not update the record.' };
  }

  return { error: null };
}
