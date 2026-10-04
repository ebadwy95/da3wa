import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { verifyGuestPageToken, makeInviteToken } from "@/lib/token";
import { siteOrigin } from "@/lib/seo";

// The map link inside a hand-sent reminder. It goes through here so that the
// guest tapping it tells the sending app the reminder arrived, then forwards
// to the venue on the map.
//
// WhatsApp and other apps fetch a link to draw its preview, from the sender's
// phone as well as the guest's; those fetches identify themselves, and they
// don't count.
const PREVIEW_AGENTS = /whatsapp|facebookexternalhit|facebot|bot|crawler|spider|preview|telegram|slack|twitter/i;

export async function GET(request, { params }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("t");
  if (!verifyGuestPageToken(id, "map", token)) {
    return NextResponse.redirect(siteOrigin());
  }

  const db = await getDb();
  const guest = db.guests.find((g) => g.id === id);
  const event = guest && db.events.find((e) => e.id === guest.eventId);
  if (!guest || !event) return NextResponse.redirect(siteOrigin());

  if (!PREVIEW_AGENTS.test(request.headers.get("user-agent") || "")) {
    await withDb((fresh) => {
      const g = fresh.guests.find((x) => x.id === id);
      if (g && !g.reminderOpenedAt) g.reminderOpenedAt = new Date().toISOString();
    });
  }

  const target =
    event.venueMapUrl || `${siteOrigin()}/invite/${guest.id}?t=${makeInviteToken(guest.id)}`;
  return NextResponse.redirect(target);
}
