import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import {
  sanitizeContacts,
  guardLink,
  liveAlertsFor,
  pushIsConfigured,
  MAX_SECURITY_CONTACTS,
} from "@/lib/security";

// Admin: the wedding's security team — who gets called to the gate — with
// each person's personal alert link and whether their phone is set up yet.
function present(db, event) {
  const devices = new Map();
  for (const s of db.pushSubscriptions || []) {
    if (s.eventId === event.id) devices.set(s.contactId, (devices.get(s.contactId) || 0) + 1);
  }
  return {
    pushConfigured: pushIsConfigured(),
    max: MAX_SECURITY_CONTACTS,
    contacts: (event.securityContacts || []).map((c) => ({
      ...c,
      link: guardLink(event.id, c.id),
      devices: devices.get(c.id) || 0,
    })),
    alerts: liveAlertsFor(db, event.id, { includeTests: true }),
  };
}

export async function GET(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const event = db.events.find((e) => e.id === id);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  return NextResponse.json(present(db, event));
}

export async function PUT(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const { contacts } = await request.json().catch(() => ({}));

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود", status: 404 };
    const clean = sanitizeContacts(contacts, event.securityContacts || []);
    if (clean.error) return { error: clean.error, status: 400 };
    event.securityContacts = clean.contacts;
    // A removed person's phones stop ringing with this wedding's alerts.
    const keep = new Set(clean.contacts.map((c) => c.id));
    db.pushSubscriptions = (db.pushSubscriptions || []).filter(
      (s) => s.eventId !== id || keep.has(s.contactId)
    );
    return { ok: true };
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  const db = await getDb();
  return NextResponse.json(present(db, db.events.find((e) => e.id === id)));
}
