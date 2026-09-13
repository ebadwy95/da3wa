import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";
import { normaliseInviteLanguage, resolveInviteCopy, sanitiseInviteCopy } from "@/lib/inviteCopy";
import { timelineLabel } from "@/lib/timeline";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";

// Public: a guest opening their personal invite link. Requires a valid
// signed token — no auth cookie needed, but the token gates access.
//
// The card is sent in one language: the guest's own (set by the couple before
// sending, Arabic unless they chose English), or `?lang=` when the page asks
// for the other one. Everything that differs between the two cards is picked
// here, so the page never has to know which fields have an English twin.
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
  const english = language === "en";

  const fullEvent = db.events.find((e) => e.id === guest.eventId) || null;

  // Whitelist, not blacklist. This endpoint is reachable by anyone holding a
  // guest's invite link, and the event record carries the couple's dashboard
  // password in plain text, their phone number, and the door scanners' codes.
  // Returning the record as-is handed all of that to every guest — the
  // scanner codes alone would let someone check people in at the door. Only
  // what the invitation actually renders goes out.
  const event = fullEvent && {
    id: fullEvent.id,
    coupleNames: fullEvent.coupleNames,
    eventDate: fullEvent.eventDate,
    eventTime: fullEvent.eventTime || "",
    // A venue is a proper name, so the Arabic one is still right on an English
    // card when no English spelling was given — the map link is what gets a
    // guest there.
    venueName: (english && fullEvent.venueNameEn) || fullEvent.venueName || "",
    venueAddress: fullEvent.venueAddress || "",
    venueMapUrl: fullEvent.venueMapUrl || "",
    welcomeMessage: fullEvent.welcomeMessage || "",
    // The opening film has the names and the first line burned into it, so
    // an English card plays the English film when there is one. Without one
    // it still plays the Arabic film rather than none: the envelope and the
    // music are the same either way.
    inviteVideoUrl: (english && fullEvent.inviteVideoUrlEn) || fullEvent.inviteVideoUrl || "",
    invitePosterUrl: fullEvent.invitePosterUrl || "",
    inviteAudioUrl: fullEvent.inviteAudioUrl || "",
    inviteTheme: fullEvent.inviteTheme === "dark" ? "dark" : "light",
    // Both appear on the face of the invitation, so both have to cross the
    // whitelist — the guest endpoint returns only what the card renders, and
    // a new field that is not listed here silently never arrives.
    latinNames: fullEvent.latinNames || "",
    // Empty on an English card without English family names, which the page
    // replaces with "the families of the bride and groom" rather than putting
    // Arabic script in an English sentence.
    familyNames: english ? fullEvent.familyNamesEn || "" : fullEvent.familyNames || "",
    // Resolved here rather than on the client: the invitation should never
    // have to know what the default wording is, and sanitising again on the
    // way out means a record written before the validation existed cannot
    // reach a guest unchecked.
    inviteCopy: resolveInviteCopy(
      sanitiseInviteCopy(english ? fullEvent.inviteCopyEn : fullEvent.inviteCopy, language),
      language
    ),
    // Each entry is { at: "20:30", label: "دخلة العريس", icon: "groom" }.
    // Validated on the way out rather than trusted: this reaches every guest,
    // and an admin typo should not be able to break the invitation for all of
    // them.
    timeline: Array.isArray(fullEvent.timeline)
      ? fullEvent.timeline
          .filter((s) => s && /^\d{2}:\d{2}$/.test(s.at) && String(s.label || "").trim())
          .map((s) => ({ at: s.at, label: timelineLabel(s, language), icon: s.icon || "" }))
      : null,
  };

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
