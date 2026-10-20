// ============================================================
// QR PAYLOAD TYPES
// ------------------------------------------------------------
// The QR code carries ONLY the event code.
//
// It deliberately does NOT carry the title, start time, or end
// time. Those live in the events table and are the single source
// of truth. If they were embedded here, anyone could re-print a
// QR image with a longer time window.
// ============================================================

export type QRPayload = {
  v: 1;
  event: string;
};

// ============================================================
// BUILD QR PAYLOAD
// Teachers and administrators call this to render the QR image.
// ============================================================

export function buildQRPayload(event: { eventId: string }): string {
  const payload: QRPayload = {
    v: 1,
    event: event.eventId,
  };

  return JSON.stringify(payload);
}

// ============================================================
// PARSE QR PAYLOAD
// ============================================================

export type ParseQRResult =
  | {
      ok: true;
      payload: QRPayload;
    }
  | {
      ok: false;
      message: string;
    };

export function parseQRPayload(raw: string): ParseQRResult {
  const trimmed = raw?.trim();

  if (!trimmed) {
    return {
      ok: false,
      message: 'Invalid QR code.',
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      message: 'Invalid QR code.',
    };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return {
      ok: false,
      message: 'Not an attendance QR code.',
    };
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.v !== 1) {
    return {
      ok: false,
      message: 'Unsupported QR code version.',
    };
  }

  if (
    typeof candidate.event !== 'string' ||
    candidate.event.trim().length === 0
  ) {
    return {
      ok: false,
      message: 'Not an attendance QR code.',
    };
  }

  return {
    ok: true,
    payload: {
      v: 1,
      event: candidate.event.trim(),
    },
  };
}
