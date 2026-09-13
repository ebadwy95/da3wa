import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";
import { normaliseInviteLanguage } from "@/lib/inviteCopy";
import { buildInviteEvent } from "@/lib/inviteEvent";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";

// Public: a guest opening their personal invite link. Requires a valid
// signed token — no auth cookie needed, but the token gates access.
//
// The card is sent in one language: the guest's own (set by the couple before
// sending, Arabic unless they chose English), or `?lang=` when the page asks
// for the other one. Everything that differs between the two cards is picked
// in buildInviteEvent, so the page never has to know which fields have an
// English twin.
export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t");

  const db = await getDb();
  const guest = db.guests.find((g) => g.id === id);
  if (!guest) {
    return NextResponse.json({ error: "الدعوة غير موجودة" }, { status: 404 });
  }

  const admin = await isAdminAuthed();
  if (!admin && !verifyInviteToken(id, token)) {
    return NextResponse.json({ error: "رابط الدعوة غير صالح" }, { status: 403 });
  }

  const language =
    normaliseInviteLanguage(searchParams.get("lang")) || normaliseInviteLanguage(guest.language) || "ar";

  const fullEvent = db.events.find((e) => e.id === guest.eventId) || null;
  const event = buildInviteEvent(fullEvent, language);

  return NextResponse.json({ guest, event, language });
}

// The couple or admin choosing which card a guest receives, before sending.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const language = normaliseInviteLanguage(body.language);
  if (!language) {
    return NextResponse.json({ error: "لغة الدعوة لازم تكون عربي أو English" }, { status: 400 });
  }

  const db = await getDb();
  const existing = db.guests.find((g) => g.id === id);
  if (!existing) {
    return NextResponse.json({ error: "الضيف غير موجود" }, { status: 404 });
  }
  if (!(await canAccessEvent(existing.eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const guest = await withDb((freshDb) => {
    const g = freshDb.guests.find((x) => x.id === id);
    if (!g) return null;
    g.language = language;
    return g;
  });
  if (!guest) {
    return NextResponse.json({ error: "الضيف غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ guest: { id: guest.id, language: guest.language } });
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  const db = await getDb();
  const guest = db.guests.find((g) => g.id === id);
  if (!guest) {
    return NextResponse.json({ error: "الضيف غير موجود" }, { status: 404 });
  }
  if (!(await canAccessEvent(guest.eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  await withDb((freshDb) => {
    freshDb.guests = freshDb.guests.filter((g) => g.id !== id);
  });
  return NextResponse.json({ ok: true });
}
