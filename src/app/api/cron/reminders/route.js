import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import {
  sendTemplateMessage,
  messagingIsConfigured,
  isUsableTemplateName,
  templateNameFor,
  describeTemplateProblem,
} from "@/lib/messaging";
import {
  computeDisplayStatus,
  daysUntil,
  formatEventDateArabic,
  formatEventTimeArabic,
  formatEventDateEnglish,
  formatEventTimeEnglish,
} from "@/lib/date";
import { resolveCoupleParts, coupleNamesIn } from "@/lib/couple";
import { guestLanguage } from "@/lib/inviteCopy";
import { isInvite } from "@/lib/guestKind";
import { isWithdrawn } from "@/lib/roll";
import { buildQrCard, cardUrls } from "@/lib/cards";
import { makeInviteToken } from "@/lib/token";
import { siteOrigin } from "@/lib/seo";

// The two messages Da3wa's own number sends in the run-up to a wedding, both
// driven by the daily Vercel cron in vercel.json. The job decides which
// weddings and which guests are due; the cron only decides when to ask.
//
//   The reminder, two days before, to guests who have confirmed: the date,
//   the time, the hall and the map — followed by their entry pass as an
//   image, which carries their name and how many people they confirmed.
//
//   The nudge, in the week or so before, to guests who still haven't
//   answered: their invitation again. The couple need numbers for the hall
//   and the caterer, and someone who never opened their invitation needs
//   asking again rather than being counted as a no.
//
// Both are idempotent by design. Every guest carries a stamp and is skipped
// once it is set, so running the job twice in a day — a retried cron, a
// manual trigger, an overlapping invocation — can't message anyone twice.
// That matters more than usual here: a duplicate message to 200 guests days
// before a wedding is the kind of mistake people remember.
export const dynamic = "force-dynamic";
// Each confirmed guest's entry pass is drawn by a real browser before their
// reminder goes out, which is slow the first time per guest.
export const maxDuration = 300;

const REMINDER_DAYS_BEFORE = 2;
// The window the nudge may go out in. Wide, because it only ever fires once
// per guest: the first daily run inside the window sends it.
const NUDGE_FROM_DAYS = 10;
const NUDGE_UNTIL_DAYS = 1;

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

function logLine(event, guest, type, waResult, content) {
  return {
    id: randomUUID(),
    eventId: event.id,
    guestId: guest.id,
    guestName: guest.name,
    phone: guest.phoneDisplay || guest.phone,
    type,
    status: waResult.simulated ? "simulated" : waResult.error ? "failed" : "sent",
    waMessageId: waResult.messageId || null,
    content,
    error: waResult.error || null,
    createdAt: new Date().toISOString(),
  };
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const reminderTemplate = templateNameFor("REMINDER");
  if (messagingIsConfigured() && !isUsableTemplateName(reminderTemplate)) {
    return NextResponse.json(
      {
        error:
          "قالب التذكير غير مضبوط — اضبط WHATSAPP_REMINDER_TEMPLATE_NAME على da3wa_reminder بعد اعتماده من Meta",
      },
      { status: 503 }
    );
  }

  const db = await getDb();

  // A wedding sending by hand from the couple's WhatsApp has its automatic
  // messages turned off (event.autoMessagesOff) and is left alone here.
  const liveEvents = db.events.filter(
    (e) => computeDisplayStatus(e) === "active" && !e.autoMessagesOff
  );

  const report = { checkedAt: new Date().toISOString(), events: [] };

  for (const event of liveEvents) {
    const days = daysUntil(event.eventDate);
    const coupleParts = resolveCoupleParts(event);
    const entry = { eventId: event.id, coupleNames: coupleParts.coupleNames, eventDate: event.eventDate, daysUntil: days };

    // ---- the reminder, two days out ----
    if (days === REMINDER_DAYS_BEFORE) {
      const missing = missingFieldsFor(event, coupleParts);
      if (missing.length > 0) {
        entry.reminder = { skipped: true, reason: `بيانات ناقصة: ${missing.join("، ")}` };
      } else {
        const recipients = db.guests.filter(
          (g) =>
            g.eventId === event.id && !isWithdrawn(g) && g.status === "confirmed" && !g.reminderSentAt
        );
        let sent = 0;
        let failed = 0;
        let passSent = 0;

        // Sequential, same as the invite send — sends are rate-limited per
        // account, and an ordered feed is easier to read when something
        // goes wrong.
        for (const guest of recipients) {
          const lang = guestLanguage(guest);
          const en = lang === "en";
          const waResult = await sendTemplateMessage({
            phone: guest.phoneDisplay || guest.phone,
            templateName: templateNameFor("REMINDER", lang) || reminderTemplate,
            broadcastName: "da3wa_event_reminder",
            params: [
              { name: "name", value: guest.name },
              { name: "groom", value: coupleParts.groomName },
              { name: "bride", value: coupleParts.brideName },
              { name: "couple", value: coupleNamesIn(event, lang) },
              {
                name: "date",
                value: en ? formatEventDateEnglish(event.eventDate) : formatEventDateArabic(event.eventDate),
              },
              {
                name: "time",
                value: en ? formatEventTimeEnglish(event.eventTime) : formatEventTimeArabic(event.eventTime),
              },
              {
                name: "venue",
                value: (en && event.venueNameEn) || event.venueName || event.venueAddress,
              },
              { name: "maplink", value: event.venueMapUrl },
            ],
          });
          if (waResult.error) failed++;
          else sent++;

          // Then the pass itself. A separate message because the approved
          // reminder template carries no image: the card is where the guest's
          // own code and the number of people they confirmed are written, and
          // on the night it is the thing they hold up at the door.
          let passResult = null;
          const passTemplate = templateNameFor("QR", lang);
          if (isUsableTemplateName(passTemplate)) {
            let cardUrl;
            try {
              await buildQrCard(guest.id, lang);
              cardUrl = cardUrls(siteOrigin(), {
                guestId: guest.id,
                token: makeInviteToken(guest.id),
              });
            } catch (err) {
              console.warn("[cron/reminders] could not draw the pass:", err.message);
            }
            passResult = await sendTemplateMessage({
              phone: guest.phoneDisplay || guest.phone,
              templateName: passTemplate,
              broadcastName: "da3wa_qr_delivery",
              headerImageUrl: cardUrl,
              params: [
                { name: "name", value: guest.name },
                { name: "groom", value: coupleParts.groomName },
                { name: "bride", value: coupleParts.brideName },
                { name: "couple", value: coupleNamesIn(event, lang) },
              ],
            });
            if (!passResult.error) passSent++;
          }

          // Stamped even on failure: a template rejection repeats identically
          // every day until someone fixes it, and re-sending daily to the
          // guests it DID reach would be worse than one missed reminder. The
          // failure is in the admin feed for exactly that reason.
          await withDb((freshDb) => {
            const g = freshDb.guests.find((x) => x.id === guest.id);
            if (g) g.reminderSentAt = new Date().toISOString();
            freshDb.messages.push(
              logLine(event, guest, "event_reminder", waResult, `تم إرسال تذكير بالزفاف إلى ${guest.name}`)
            );
            if (passResult) {
              freshDb.messages.push(
                logLine(event, guest, "qr_delivery", passResult, `تم إرسال بطاقة الدخول إلى ${guest.name} مع التذكير`)
              );
            }
          });
        }
        entry.reminder = { recipients: recipients.length, sent, failed, passSent };
      }
    }

    // ---- the nudge, to everyone who hasn't answered ----
    if (days !== null && days >= NUDGE_UNTIL_DAYS && days <= NUDGE_FROM_DAYS) {
      // Its own template when one is configured — the same invitation, worded
      // as a reminder — and the invitation itself until then, so a missing
      // template delays nothing.
      const useNudge = isUsableTemplateName(templateNameFor("NUDGE"));
      const templateFor = (lang) =>
        useNudge ? templateNameFor("NUDGE", lang) : templateNameFor("INVITE", lang);
      const waiting = db.guests.filter(
        (g) =>
          g.eventId === event.id &&
          !isWithdrawn(g) &&
          isInvite(g) &&
          g.status === "pending" &&
          !g.nudgeSentAt
      );
      if (!isUsableTemplateName(templateFor("ar"))) {
        entry.nudge = { skipped: true, reason: "قالب التذكير بالردّ غير مضبوط" };
      } else if (waiting.length) {
        // A template submitted the same week it is wanted may still be in
        // review, and Meta rejects an unapproved one once per guest. Asking
        // the account first, once per template, is the difference between
        // waiting a day for the approval and spending every guest's single
        // nudge on a 400 — nobody here gets a second one.
        const problems = new Map();
        for (const name of new Set(waiting.map((g) => templateFor(guestLanguage(g))))) {
          problems.set(name, await describeTemplateProblem(name));
        }
        const waitingOn = [...new Set(problems.values())].filter(Boolean);

        let sent = 0;
        let failed = 0;
        let held = 0;
        const base = siteOrigin();
        for (const guest of waiting) {
          const lang = guestLanguage(guest);
          const templateName = templateFor(lang);
          // Left untouched for the next run, not stamped and lost.
          if (problems.get(templateName)) {
            held++;
            continue;
          }
          const link = `${base}/invite/${guest.id}?t=${makeInviteToken(guest.id)}`;
          const waResult = await sendTemplateMessage({
            phone: guest.phoneDisplay || guest.phone,
            templateName,
            broadcastName: "da3wa_rsvp_nudge",
            params: [
              { name: "name", value: guest.name },
              { name: "groom", value: coupleParts.groomName },
              { name: "bride", value: coupleParts.brideName },
              { name: "couple", value: coupleNamesIn(event, lang) },
              { name: "link", value: link },
            ],
          });
          if (waResult.error) failed++;
          else sent++;

          await withDb((freshDb) => {
            const g = freshDb.guests.find((x) => x.id === guest.id);
            // Stamped only when the message actually went out. The reminder
            // stamps either way, because a template rejection there would
            // repeat for everyone; here the template is known to be approved
            // before the loop starts, so a failure is this one number's
            // problem and worth trying again tomorrow.
            if (g && !waResult.error) {
              g.nudgeSentAt = new Date().toISOString();
              // The nudge is the invitation, so a guest who was never sent
              // one has now had it.
              if (!g.invitedAt) g.invitedAt = g.nudgeSentAt;
            }
            freshDb.messages.push(
              logLine(event, guest, "rsvp_nudge", waResult, `تم إرسال تذكير بالردّ إلى ${guest.name}`)
            );
          });
        }
        entry.nudge = { recipients: waiting.length, sent, failed, held };
        if (waitingOn.length) entry.nudge.waitingOn = waitingOn;
      }
    }

    if (entry.reminder || entry.nudge) report.events.push(entry);
  }

  return NextResponse.json(report);
}
