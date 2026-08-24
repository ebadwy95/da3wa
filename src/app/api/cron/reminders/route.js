import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { sendTemplateMessage, watiIsConfigured, isUsableTemplateName } from "@/lib/wati";
import {
  computeDisplayStatus,
  daysUntil,
  formatEventDateArabic,
  formatEventTimeArabic,
} from "@/lib/date";
import { resolveCoupleParts } from "@/lib/couple";

// Automatic "your wedding is in two days" reminder, sent to guests who have
// already confirmed. Triggered by the Vercel cron in vercel.json, which runs
// this once a day; the job itself decides which events are due.
//
// Sending is idempotent by design. Guests carry a reminderSentAt stamp and are
// skipped once it's set, so running the job twice in a day — a retried cron, a
// manual trigger, an overlapping invocation — can't message anyone twice. That
// matters more than usual here: a duplicate reminder to 200 guests two days
// before a wedding is the kind of mistake people remember.
export const dynamic = "force-dynamic";

const REMINDER_DAYS_BEFORE = 2;

// Vercel sends this header on scheduled invocations when CRON_SECRET is set.
// Without it the endpoint would be a public "message everyone" button.
function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// The reminder template fills in a full set of practical details. Any of them
// missing would reach the guest as a gap in the sentence, so the event is
// skipped and named in the response instead — the admin can fill the field in
// and the next day's run picks it up.
function missingFieldsFor(event, coupleParts) {
  const missing = [];
  if (!coupleParts.groomName) missing.push("اسم العريس");
  if (!coupleParts.brideName) missing.push("اسم العروسة");
  if (!event.eventTime) missing.push("وقت الحفل");
  if (!event.venueName && !event.venueAddress) missing.push("اسم القاعة");
  if (!event.venueMapUrl) missing.push("رابط الموقع على الخريطة");
  return missing;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const templateName = process.env.WATI_REMINDER_TEMPLATE_NAME;
  if (watiIsConfigured() && !isUsableTemplateName(templateName)) {
    return NextResponse.json(
      {
        error:
          "قالب التذكير غير مضبوط — اضبط WATI_REMINDER_TEMPLATE_NAME على da3wa_event_reminder بعد اعتماده من Meta",
      },
      { status: 503 }
    );
  }

  const db = await getDb();

  const dueEvents = db.events.filter(
    (e) =>
      computeDisplayStatus(e) === "active" &&
      daysUntil(e.eventDate) === REMINDER_DAYS_BEFORE
  );

  const report = { checkedAt: new Date().toISOString(), events: [] };

  for (const event of dueEvents) {
    const coupleParts = resolveCoupleParts(event);
    const missing = missingFieldsFor(event, coupleParts);

    if (missing.length > 0) {
      report.events.push({
        eventId: event.id,
        coupleNames: coupleParts.coupleNames,
        skipped: true,
        reason: `بيانات ناقصة: ${missing.join("، ")}`,
      });
      continue;
    }

    const recipients = db.guests.filter(
      (g) => g.eventId === event.id && g.status === "confirmed" && !g.reminderSentAt
    );

    let sent = 0;
    let failed = 0;

    // Sequential, same as the invite send — Wati rate-limits per account, and
    // an ordered feed is easier to read when something goes wrong.
    for (const guest of recipients) {
      const waResult = await sendTemplateMessage({
        phone: guest.phoneDisplay || guest.phone,
        templateName,
        broadcastName: "da3wa_event_reminder",
        params: [
          { name: "name", value: guest.name },
          { name: "groom", value: coupleParts.groomName },
          { name: "bride", value: coupleParts.brideName },
          { name: "date", value: formatEventDateArabic(event.eventDate) },
          { name: "time", value: formatEventTimeArabic(event.eventTime) },
          { name: "venue", value: event.venueName || event.venueAddress },
          { name: "maplink", value: event.venueMapUrl },
        ],
      });

      const status = waResult.simulated ? "simulated" : waResult.error ? "failed" : "sent";
      if (status === "failed") failed++;
      else sent++;

      // Stamped even on failure: a template rejection repeats identically
      // every day until someone fixes it, and re-sending daily to the guests
      // it DID reach would be worse than one missed reminder. The failure is
      // in the admin feed for exactly that reason.
      await withDb((freshDb) => {
        const g = freshDb.guests.find((x) => x.id === guest.id);
        if (g) g.reminderSentAt = new Date().toISOString();
        freshDb.messages.push({
          id: randomUUID(),
          eventId: event.id,
          guestId: guest.id,
          guestName: guest.name,
          phone: guest.phoneDisplay || guest.phone,
          type: "event_reminder",
          status,
          content: `تم إرسال تذكير بالزفاف إلى ${guest.name}`,
          error: waResult.error || null,
          createdAt: new Date().toISOString(),
        });
      });
    }

    report.events.push({
      eventId: event.id,
      coupleNames: coupleParts.coupleNames,
      eventDate: event.eventDate,
      recipients: recipients.length,
      sent,
      failed,
    });
  }

  return NextResponse.json(report);
}
