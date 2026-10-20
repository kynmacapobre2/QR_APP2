import { supabase } from './supabase';

// ============================================================
// TYPES
// ============================================================

export type EventStatus = 'open' | 'closed';

/** Input shape used when creating an event. */
export type EventInput = {
  eventCode: string;
  title: string;
  venue?: string;
  description?: string;
  start: string;
  end: string;
};

/** An event row as it exists in the database. */
export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
};

// ============================================================
// HELPER — normalize a database row
// ============================================================

function toCloudEvent(row: any): CloudEvent {
  return {
    id: row.id,
    event_code: row.event_code,
    title: row.title,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    venue: row.venue ?? null,
    description: row.description ?? null,
    status: (row.status as EventStatus) ?? 'open',
    created_by: row.created_by ?? null,
    created_at: row.created_at,
  };
}

// ============================================================
// CREATE EVENT
// Teachers and administrators only. Row Level Security
// enforces the role; this returns a friendly error message.
// ============================================================

export async function createEvent(
  event: EventInput
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to create an event.' };
  }

  const cleanCode = event.eventCode.trim().toUpperCase();

  if (!cleanCode) {
    return { error: 'Event code is required.' };
  }

  if (!event.title.trim()) {
    return { error: 'Event title is required.' };
  }

  // A plain insert (not upsert) so a duplicate code is a real error
  // instead of silently overwriting someone else's event.
  const { error } = await supabase.from('events').insert({
    event_code: cleanCode,
    title: event.title.trim(),
    venue: event.venue?.trim() || null,
    description: event.description?.trim() || null,
    start_time: event.start || null,
    end_time: event.end || null,
    status: 'open',
    created_by: user.id,
  });

  if (!error) {
    return { error: null };
  }

  if (error.code === '23505') {
    return {
      error: 'That event code is already in use. Choose another.',
    };
  }

  if (error.code === '42501') {
    return {
      error: 'You do not have permission to create events.',
    };
  }

  return { error: error.message };
}

// ============================================================
// UPDATE EVENT
// Teachers may edit their own events; admins may edit any.
// The event code is intentionally not editable: the QR already
// encodes it, so changing it would invalidate printed codes.
// ============================================================

export async function updateEvent(
  eventId: string,
  updates: {
    title?: string;
    venue?: string;
    description?: string;
    start?: string;
    end?: string;
  }
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();

    if (!cleanTitle) {
      return { error: 'Event title cannot be empty.' };
    }

    patch.title = cleanTitle;
  }

  if (updates.venue !== undefined) {
    patch.venue = updates.venue.trim() || null;
  }

  if (updates.description !== undefined) {
    patch.description = updates.description.trim() || null;
  }

  if (updates.start !== undefined) {
    patch.start_time = updates.start || null;
  }

  if (updates.end !== undefined) {
    patch.end_time = updates.end || null;
  }

  if (Object.keys(patch).length === 0) {
    return { error: null };
  }

  const { error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', eventId);

  if (error) {
    if (error.code === '42501') {
      return { error: 'You do not have permission to edit this event.' };
    }

    return { error: error.message };
  }

  return { error: null };
}

// ============================================================
// CLOSE EVENT
// Stops attendance. record_attendance() checks this status in
// the database, so closing is enforced server-side.
// ============================================================

export async function closeEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'closed' })
    .eq('id', eventId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ============================================================
// REOPEN EVENT
// ============================================================

export async function reopenEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'open' })
    .eq('id', eventId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ============================================================
// GET EVENTS BY TEACHER
// ============================================================

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(toCloudEvent);
}

// ============================================================
// GET EVENT BY CODE
// ============================================================

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code.trim().toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toCloudEvent(data);
}

// ============================================================
// GET EVENT BY ID
// ============================================================

export async function getEventById(
  eventId: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toCloudEvent(data);
}

// ============================================================
// GET AVAILABLE (OPEN) EVENTS
// ============================================================

export async function getAvailableEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'open')
    .order('start_time', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(toCloudEvent);
}

// ============================================================
// GET ALL EVENTS
// Administrator view.
// ============================================================

export async function getAllEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(toCloudEvent);
}

// ============================================================
// DELETE EVENT
// Creator or admin. Attendance rows cascade automatically.
// ============================================================

export async function deleteEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
