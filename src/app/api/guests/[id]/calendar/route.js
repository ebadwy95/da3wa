import { getDb } from "@/lib/db";
import { verifyInviteToken, makeInviteToken } from "@/lib/token";
import { coupleNamesIn } from "@/lib/couple";
import { siteOrigin } from "@/lib/seo";
import { eventWindow, calendarTitle, icsFile } from "@/lib/calendar";

// The wedding as a calendar file, for a confirmed guest's "add to calendar".
// An iPhone opens it straight into "Add Event"; the three reminders inside
// it (two days, one day and six hours before) are the phone's own.
export async function GET(request, { params }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("t");
  if (!verifyInviteToken(id, token)) return new Response("Invalid link", { status: 403 });

  const db = await getDb();
  const guest = db.guests.find((g) => g.id === id);
  const event = guest && db.events.find((e) => e.id === guest.eventId);
  const span = event && eventWindow(event.eventDate, event.eventTime);
  if (!span) return new Response("Not found", { status: 404 });

  const lang = guest.language === "en" ? "en" : "ar";
  const venue = (lang === "en" && event.venueNameEn) || event.venueName || "";
  const inviteLink = `${siteOrigin()}/invite/${guest.id}?t=${makeInviteToken(guest.id)}`;
  const details = [
    lang === "en" ? "Your entry pass is on your invitation:" : "بطاقة الدخول على رابط دعوتك:",
    inviteLink,
    event.venueMapUrl ? `${lang === "en" ? "Map" : "الموقع"}: ${event.venueMapUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body = icsFile({
    uid: guest.id,
    title: calendarTitle(coupleNamesIn(event, lang), lang),
    ...span,
    location: [venue, event.venueAddress].filter(Boolean).join(" — "),
    details,
    url: inviteLink,
    lang,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="da3wa-wedding.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
