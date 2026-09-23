import { supabase } from './supabase';

// ============================================================
// TYPES
// ============================================================

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};


// ============================================================
// CREATE EVENT
// ============================================================

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('events')
    .upsert(
      {
        event_code: event.eventId,
        title: event.title,
        start_time: event.start || null,
        end_time: event.end || null,
        created_by: user?.id ?? null,
      },
      {
        onConflict: 'event_code',
      }
    );

  return {
    error: error?.message ?? null,
  };
}


// ============================================================
// GET EVENTS BY TEACHER
// ============================================================

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {

  const {
    data,
    error,
  } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}


// ============================================================
// GET EVENT BY CODE
// ============================================================

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {

  const {
    data,
    error,
  } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}