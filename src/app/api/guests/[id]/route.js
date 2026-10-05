import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { recordInviteOpen } from "@/lib/inviteOpens";
import { verifyInviteToken, makeCardToken } from "@/lib/token";
import { thanksOpen } from "@/lib/handSend";
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

  // Only a real guest's visit counts. An admin opening the same link to check
  // the card would otherwise look like the guest reading their invitation.
  const opened = admin ? null : await recordInviteOpen(id);

  // From the day after the wedding, a guest who came gets the thank-you card
  // at the top of the same link — what a hand-sent thank-you points to.
  const thanksCard =
    guest.status === "confirmed" && fullEvent && thanksOpen(fullEvent)
      ? `/api/cards/thanks/${fullEvent.id}/card.png?lang=${language}&t=${makeCardToken(fullEvent.id)}`
      : null;

  return NextResponse.json({ guest: opened || guest, event, language, thanksCard });
}

// The couple or admin choosing which card a guest receives, before sending,
// and whose guest they are (which of the two sends to them from /send).
export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const changes = {};
  if ("language" in body) {
    changes.language = normaliseInviteLanguage(body.language);
    if (!changes.language) {
      return NextResponse.json({ error: "لغة الدعوة لازم تكون عربي أو English" }, { status: 400 });
    }
  }
  // Whose guest: the groom's, the bride's, or null for not decided.
  if ("side" in body) {
    if (body.side !== null && !["groom", "bride"].includes(body.side)) {
      return NextResponse.json({ error: "الطرف لازم يكون العريس أو العروس" }, { status: 400 });
    }
    changes.side = body.side;
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "لا يوجد تعديل" }, { status: 400 });
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
    Object.assign(g, changes);
    return g;
  });
  if (!guest) {
    return NextResponse.json({ error: "الضيف غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ guest: { id: guest.id, language: guest.language, side: guest.side || null } });
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
