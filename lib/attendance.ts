import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';

// ============================================================
// STUDENT ATTENDANCE TYPES
// ============================================================

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

// ============================================================
// TEACHER ATTENDANCE TYPES
// ============================================================

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    scannedAt: string;
  }[];
};

// ============================================================
// TEACHER EVENT SUMMARY TYPE
// ============================================================

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

// ============================================================
// REGISTER ATTENDANCE
// ============================================================

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {

  // ----------------------------------------------------------
  // STEP 1 — Decode and validate the QR code
  // ----------------------------------------------------------

  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: parsed.message,
    };
  }

  const payload = parsed.payload;

  // ----------------------------------------------------------
  // STEP 2 — Check the event time window
  // ----------------------------------------------------------

  const now = Date.now();

  const start = payload.start
    ? new Date(payload.start).getTime()
    : null;

  const end = payload.end
    ? new Date(payload.end).getTime()
    : null;

  if (start && now < start) {
    return {
      success: false,
      message: 'Event has not started yet.',
    };
  }

  if (end && now > end) {
    return {
      success: false,
      message: 'Event has already ended.',
    };
  }

  // ----------------------------------------------------------
  // STEP 3 — Find or create the event
  // ----------------------------------------------------------

  const title = payload.title ?? payload.event;

  let event: {
    id: string;
    title: string;
  } | null = null;

  // Use the shared cloud event lookup
  const foundEvent = await getEventByCode(
    payload.event
  );

  if (foundEvent) {
    event = foundEvent;
  } else {

    // --------------------------------------------------------
    // Event does not exist yet — create it
    // --------------------------------------------------------

    const {
      data: newEvent,
      error: insertError,
    } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();

    if (insertError) {
      return {
        success: false,
        message: 'Could not create event.',
      };
    }

    event = newEvent;
  }

  // ----------------------------------------------------------
  // STEP 4 — Record attendance
  // ----------------------------------------------------------

  const { error: attError } = await supabase
    .from('attendance')
    .insert([
      {
        student_id: studentId,
        event_id: event.id,
      },
    ]);

  if (attError) {

    // Duplicate attendance
    if (attError.code === '23505') {
      return {
        success: false,
        message: 'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    return {
      success: false,
      message: attError.message,
    };
  }

  // ----------------------------------------------------------
  // SUCCESS
  // ----------------------------------------------------------

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
  };
}

// ============================================================
// GET STUDENT ATTENDANCE HISTORY
// ============================================================

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {

  const {
    data,
    error,
  } = await supabase
    .from('attendance')
    .select(
      'id, scanned_at, events ( event_code, title )'
    )
    .eq('student_id', studentId)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    return [];
  }

  return data.map((row: any): AttendanceRecord => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
  }));
}

// ============================================================
// GET TEACHER EVENT ATTENDANCE
// ============================================================

/**
 * Get all events created by a teacher
 * and the attendance recorded for those events.
 */
export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {

  // -----------------------------------------
  // STEP 1:
  // Get events created by this teacher
  // -----------------------------------------

  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title, start_time, end_time'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.log(
      'Teacher events error:',
      eventError?.message
    );

    return [];
  }

  const eventIds = events.map(
    (event: any) => event.id
  );

  // No events created by this teacher
  if (eventIds.length === 0) {
    return [];
  }

  // -----------------------------------------
  // STEP 2:
  // Get attendance for those events
  // -----------------------------------------

  const {
    data: attendance,
    error: attendanceError,
  } = await supabase
    .from('attendance')
    .select(
      'student_id, scanned_at, event_id'
    )
    .in('event_id', eventIds)
    .order('scanned_at', {
      ascending: false,
    });

  if (attendanceError || !attendance) {
    console.log(
      'Teacher attendance error:',
      attendanceError?.message
    );

    return [];
  }

  // -----------------------------------------
  // STEP 3:
  // Group attendance by event
  // -----------------------------------------

  return events.map((event: any) => {
    const rows = attendance.filter(
      (attendanceRow: any) =>
        attendanceRow.event_id === event.id
    );

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,

      attendeeCount: rows.length,

      attendees: rows.map(
        (attendanceRow: any) => ({
          studentId:
            attendanceRow.student_id,

          scannedAt:
            attendanceRow.scanned_at,
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

  // ----------------------------------------------------------
  // STEP 1 — Get only the teacher's event information
  // ----------------------------------------------------------

  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.log(
      'Teacher event summary error:',
      eventError?.message
    );

    return [];
  }

  const eventIds = events.map(
    (event: any) => event.id
  );

  // ----------------------------------------------------------
  // STEP 2 — No events means nothing to count
  // ----------------------------------------------------------

  if (eventIds.length === 0) {
    return [];
  }

  // ----------------------------------------------------------
  // STEP 3 — Lightweight attendance query
  // Only download event_id
  // ----------------------------------------------------------

  const {
    data: attRows,
    error: attError,
  } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    console.log(
      'Teacher attendance summary error:',
      attError?.message
    );

    return [];
  }

  // ----------------------------------------------------------
  // STEP 4 — Count attendance rows per event
  // ----------------------------------------------------------

  const counts: Record<string, number> = {};

  attRows.forEach((row: any) => {
    counts[row.event_id] =
      (counts[row.event_id] ?? 0) + 1;
  });

  // ----------------------------------------------------------
  // STEP 5 — Build the summary
  // ----------------------------------------------------------

  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount:
      counts[event.id] ?? 0,
  }));
}