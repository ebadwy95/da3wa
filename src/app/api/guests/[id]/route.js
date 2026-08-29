import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";

// Public: a guest opening their personal invite link. Requires a valid
// signed token — no auth cookie needed, but the token gates access.
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
    venueName: fullEvent.venueName || "",
    venueAddress: fullEvent.venueAddress || "",
    venueMapUrl: fullEvent.venueMapUrl || "",
    welcomeMessage: fullEvent.welcomeMessage || "",
    inviteVideoUrl: fullEvent.inviteVideoUrl || "",
    invitePosterUrl: fullEvent.invitePosterUrl || "",
    inviteAudioUrl: fullEvent.inviteAudioUrl || "",
    inviteTheme: fullEvent.inviteTheme === "dark" ? "dark" : "light",
    // Both appear on the face of the invitation, so both have to cross the
    // whitelist — the guest endpoint returns only what the card renders, and
    // a new field that is not listed here silently never arrives.
    latinNames: fullEvent.latinNames || "",
    familyNames: fullEvent.familyNames || "",
    // Each entry is { at: "20:30", label: "دخلة العريس", icon: "groom" }.
    // Validated on the way out rather than trusted: this reaches every guest,
    // and an admin typo should not be able to break the invitation for all of
    // them.
    timeline: Array.isArray(fullEvent.timeline)
      ? fullEvent.timeline
          .filter((s) => s && /^\d{2}:\d{2}$/.test(s.at) && String(s.label || "").trim())
          .map((s) => ({ at: s.at, label: String(s.label).trim(), icon: s.icon || "" }))
      : null,
  };

  return NextResponse.json({ guest, event });
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
