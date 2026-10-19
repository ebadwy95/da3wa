import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { recordInviteOpen } from "@/lib/inviteOpens";
import { verifyInviteToken, makeCardToken } from "@/lib/token";
import { thanksOpen } from "@/lib/handSend";
import { normaliseInviteLanguage } from "@/lib/inviteCopy";
import { normalizePhone } from "@/lib/phone";
import { GUEST_KINDS } from "@/lib/guestKind";
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
  // Correcting the guest themself. A misspelled name is worth fixing at any
  // time — their entry pass is then printed right — so it goes in with the
  // rest. The phone number is locked once the guest has opened their
  // invitation: changing it hands their invitation to somebody else.
  const locked = {};
  if ("name" in body) {
    changes.name = String(body.name || "").trim();
    if (!changes.name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  }
  if ("phone" in body) {
    const parsed = normalizePhone(body.phone);
    if (!parsed.valid) return NextResponse.json({ error: parsed.error }, { status: 400 });
    locked.phone = parsed.digits;
    locked.phoneDisplay = parsed.e164;
  }
  // The allowance. Raising it is always allowed: the guest was promised a
  // number and is now being promised more, which breaks no promise and is how
  // "he called, he is bringing three" gets recorded. Lowering it after they
  // have seen their invitation is the one that has to stay shut.
  let wantedAllowance = null;
  if ("maxGuests" in body) {
    wantedAllowance = Math.max(1, parseInt(body.maxGuests, 10) || 1) - 1;
    changes.maxCompanions = wantedAllowance;
  }

  // How many are actually coming, for a guest who has already answered. The
  // guest's own answer stands until somebody tells us otherwise, and when
  // they do it is over the phone to the couple, not through the link — which
  // is closed to them by then. Without this the only record of "we are four
  // now" was a message nobody could act on: it has to reach the headcount
  // the caterer works from and the number printed on the entry pass.
  const attending = "attending" in body ? Math.max(1, parseInt(body.attending, 10) || 1) : null;

  // Taking a message off the wall, or putting it back. Admin only: the
  // dashboard still shows it, so nothing a guest wrote is lost.
  if ("wishHidden" in body) {
    if (!(await isAdminAuthed())) {
      return NextResponse.json({ error: "إخفاء المباركات للإدارة فقط" }, { status: 403 });
    }
    changes.wishHidden = Boolean(body.wishHidden);
  }

  // "This one already has their invitation — I sent it myself."
  //
  // The bulk send deliberately messages everyone with no invitedAt, which is
  // right for a guest nobody has got to and wrong for one who was sent their
  // link by hand: they would receive it a second time, from a number they've
  // already heard from. Marking it here takes them out of that batch.
  //
  // Stamped separately from invitedAt so the row can say it was logged rather
  // than sent, and so the undo below can only ever take back a hand mark —
  // never make the system forget a message it really sent.
  const markInvited = "invited" in body ? Boolean(body.invited) : null;

  // "لن يحضر" — off the roll, without deleting them. See src/lib/roll.js for
  // why this is a stamp of its own and not a fourth status.
  const markWithdrawn = "withdrawn" in body ? Boolean(body.withdrawn) : null;

  // What the link is: an invitation, the family's card, or sharing the joy.
  if ("kind" in body) {
    if (!GUEST_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: "نوع الدعوة غير معروف" }, { status: 400 });
    }
    changes.kind = body.kind;
  }

  if (
    Object.keys(changes).length === 0 &&
    Object.keys(locked).length === 0 &&
    markInvited === null &&
    markWithdrawn === null &&
    attending === null
  ) {
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
    if (!g) return { missing: true };
    const seen = g.openedAt || g.status !== "pending";
    if (Object.keys(locked).length && seen) return { blocked: true };
    // Lowering the allowance for a guest who has already seen it: refused for
    // the same reason the number is locked at all.
    if (wantedAllowance !== null && seen && wantedAllowance < (g.maxCompanions || 0)) {
      return { blocked: true };
    }
    Object.assign(g, changes, locked);
    if (attending !== null) {
      if (g.status !== "confirmed") return { notConfirmed: true };
      // Never more than the allowance — the door would turn the extra away,
      // and the pass would be promising something the couple did not.
      const companions = Math.min(attending - 1, g.maxCompanions || 0);
      g.confirmedCompanions = Math.max(0, companions);
    }
    if (markInvited === true && !g.invitedAt) {
      g.invitedAt = new Date().toISOString();
      g.invitedByHand = g.invitedAt;
    } else if (markInvited === false && g.invitedByHand) {
      g.invitedAt = null;
      g.invitedByHand = null;
    }
    if (markWithdrawn === true) g.withdrawnAt = g.withdrawnAt || new Date().toISOString();
    else if (markWithdrawn === false) g.withdrawnAt = null;
    return g;
  });
  if (guest.missing) {
    return NextResponse.json({ error: "الضيف غير موجود" }, { status: 404 });
  }
  if (guest.notConfirmed) {
    return NextResponse.json(
      { error: "عدد الحاضرين يتحدّد فقط لضيف أكّد حضوره" },
      { status: 409 }
    );
  }
  if (guest.blocked) {
    return NextResponse.json(
      { error: "الضيف شاف دعوته — العدد يزيد بس وما ينقص، والرقم ما يتغيّر. الاسم يتعدّل عادي." },
      { status: 409 }
    );
  }
  return NextResponse.json({ guest });
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
