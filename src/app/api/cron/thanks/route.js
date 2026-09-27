import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import {
  sendTemplateMessage,
  messagingIsConfigured,
  isUsableTemplateName,
  templateNameFor,
} from "@/lib/messaging";
import { daysSince } from "@/lib/date";
import { resolveCoupleParts } from "@/lib/couple";
import { buildThanksCard, cardUrls, guestLanguage } from "@/lib/cards";
import { makeCardToken } from "@/lib/token";
import { siteOrigin } from "@/lib/seo";

// The card the couple sends the day after their wedding, to the guests who
// actually said they were coming.
//
// The day after, not the same night: the wedding ends around midnight, and a
// thank-you that lands while people are still driving home reads as automated,
// which is the one thing it must not read as. Vercel runs this at 11:00 UTC —
// 2 in the afternoon in Kuwait — and the job picks the weddings that were
// yesterday.
//
// Like the reminder, every guest carries a stamp and is skipped once it is
// set, so a retried or double-fired cron cannot thank anyone twice.
export const dynamic = "force-dynamic";
// Each wedding needs its card drawn once per language before the first send.
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const templateName = templateNameFor("THANKS");
  if (messagingIsConfigured() && !isUsableTemplateName(templateName)) {
    return NextResponse.json(
      {
        error:
          "قالب الشكر غير مضبوط — اضبط WHATSAPP_THANKS_TEMPLATE_NAME على القالب المعتمد من Meta",
      },
      { status: 503 }
    );
  }

  const db = await getDb();
  // Yesterday's weddings. Deleted ones are left alone — an event that was
  // cancelled should not thank anybody.
  const dueEvents = db.events.filter(
    (e) => e.status !== "deleted" && daysSince(e.eventDate) === 1
  );

  const report = { checkedAt: new Date().toISOString(), events: [] };

  for (const event of dueEvents) {
    const coupleParts = resolveCoupleParts(event);
    const recipients = db.guests.filter(
      (g) => g.eventId === event.id && g.status === "confirmed" && !g.thanksSentAt
    );
    if (recipients.length === 0) continue;

    // One card per language, drawn before the first send so every guest's
    // message points at an image that is already in the cache.
    const cardUrlFor = {};
    const languages = [...new Set(recipients.map(guestLanguage))];
    for (const lang of languages) {
      try {
        await buildThanksCard(event.id, lang);
        cardUrlFor[lang] = cardUrls(siteOrigin(), {
          eventId: event.id,
          token: makeCardToken(event.id),
          lang,
        });
      } catch (err) {
        console.warn(`[cron/thanks] could not draw the ${lang} card:`, err.message);
      }
    }

    let sent = 0;
    let failed = 0;

    for (const guest of recipients) {
      const lang = guestLanguage(guest);
      const waResult = await sendTemplateMessage({
        phone: guest.phoneDisplay || guest.phone,
        templateName,
        broadcastName: "da3wa_thank_you",
        headerImageUrl: cardUrlFor[lang],
        params: [
          { name: "name", value: guest.name },
          { name: "groom", value: coupleParts.groomName },
          { name: "bride", value: coupleParts.brideName },
          { name: "couple", value: coupleParts.coupleNames },
        ],
      });

      const status = waResult.simulated ? "simulated" : waResult.error ? "failed" : "sent";
      if (status === "failed") failed++;
      else sent++;

      await withDb((freshDb) => {
        const g = freshDb.guests.find((x) => x.id === guest.id);
        if (g) g.thanksSentAt = new Date().toISOString();
        freshDb.messages.push({
          id: randomUUID(),
          eventId: event.id,
          guestId: guest.id,
          guestName: guest.name,
          phone: guest.phoneDisplay || guest.phone,
          type: "thank_you",
          status,
          waMessageId: waResult.messageId || null,
          content: `تم إرسال بطاقة الشكر إلى ${guest.name}`,
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
