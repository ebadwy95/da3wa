import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { verifyInviteToken, makeInviteToken } from "@/lib/token";
import { generateGuestQr } from "@/lib/qr";
import { buildQrCard, cardUrls } from "@/lib/cards";
import { siteOrigin } from "@/lib/seo";
import {
  sendTemplateMessage,
  messagingIsConfigured,
  isUsableTemplateName,
  templateNameFor,
} from "@/lib/messaging";
import { resolveCoupleParts } from "@/lib/couple";

// Public endpoint: the guest confirms or declines from their invite page.
// Body: { token, attending: boolean, companions?: number }
//
// The order below matters. A withDb mutator can be re-run if another request
// writes first (see src/lib/db.js), so the WhatsApp send — which must happen
// exactly once — deliberately sits BETWEEN two separate withDb calls rather
// than inside either of them: record the answer, send the QR, then log what
// the send actually did.
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { token, attending, companions } = body;

  if (!verifyInviteToken(id, token)) {
    return NextResponse.json({ error: "رابط الدعوة غير صالح" }, { status: 403 });
  }

  // Deterministic from the guest id (and cheap), so generating it before the
  // write keeps the mutator itself fast and free of async work.
  const qr = attending ? await generateGuestQr(id) : null;

  // 1. Record the guest's answer.
  const outcome = await withDb((db) => {
    const guest = db.guests.find((g) => g.id === id);
    if (!guest) return { error: "الضيف غير موجود", status: 404 };
    const event = db.events.find((e) => e.id === guest.eventId);

    const clampedCompanions = Math.max(
      0,
      Math.min(guest.maxCompanions, parseInt(companions, 10) || 0)
    );

    guest.status = attending ? "confirmed" : "declined";
    guest.confirmedCompanions = attending ? clampedCompanions : 0;
    guest.respondedAt = new Date().toISOString();
    if (attending) guest.qrDataUrl = qr.dataUrl;

    return {
      guest: structuredClone(guest),
      coupleParts: resolveCoupleParts(event),
    };
  });

  if (outcome.error) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status || 400 });
  }

  const { guest, coupleParts } = outcome;

  // 2. Send the QR over WhatsApp — outside any transaction, so a retry can
  //    never send it twice.
  //
  //    If the QR template name is missing we skip the send rather than fall
  //    back to a default name (this used to send Meta's "hello_world" sample
  //    to real guests). The guest's confirmation still stands and their QR is
  //    already on their invite page — only the WhatsApp copy is missing, and
  //    the admin feed says exactly why.
  const qrTemplateName = templateNameFor("QR");
  let waResult = null;
  if (attending && messagingIsConfigured() && !isUsableTemplateName(qrTemplateName)) {
    waResult = {
      error:
        "لم يُرسَل رمز QR على واتساب: WHATSAPP_QR_TEMPLATE_NAME غير مضبوط على قالب معتمد (اضبطه على da3wa_qr_delivery بعد اعتماده من Meta)",
    };
  } else if (attending) {
    // The entry pass is an image, and WhatsApp fetches that image itself, from
    // Meta's servers, with its own patience for a slow response. Drawing the
    // card here first means the URL it fetches is already sitting in the cache
    // — a render that fails is also caught here, where it can be reported,
    // rather than becoming a broken image in a guest's chat.
    const cardUrl = cardUrls(siteOrigin(), {
      guestId: guest.id,
      token: makeInviteToken(guest.id),
    });
    //
    // Only when something is actually going to be sent: with no provider
    // configured the send is simulated, and drawing a card nobody will receive
    // would make the guest wait on a browser for nothing.
    let cardReady = false;
    if (messagingIsConfigured()) {
      try {
        await buildQrCard(guest.id);
        cardReady = true;
      } catch (err) {
        console.warn("[confirm] could not draw the entry pass:", err.message);
      }
    }

    waResult = await sendTemplateMessage({
      phone: guest.phoneDisplay || guest.phone,
      templateName: qrTemplateName || "da3wa_qr",
      broadcastName: "da3wa_qr_delivery",
      headerImageUrl: cardReady ? cardUrl : undefined,
      params: [
        { name: "name", value: guest.name },
        { name: "groom", value: coupleParts.groomName },
        { name: "bride", value: coupleParts.brideName },
        { name: "couple", value: coupleParts.coupleNames },
      ],
    });
  }

  // 3. Log the outcome for the admin feed.
  await withDb((db) => {
    db.messages.push({
      id: randomUUID(),
      eventId: guest.eventId,
      guestId: guest.id,
      guestName: guest.name,
      phone: guest.phoneDisplay || guest.phone,
      type: attending ? "qr_delivery" : "decline_notice",
      status: waResult ? (waResult.simulated ? "simulated" : waResult.error ? "failed" : "sent") : "logged",
      waMessageId: waResult?.messageId || null,
      content: attending
        ? `تم إرسال كود QR للدخول إلى ${guest.name} (${guest.phoneDisplay || guest.phone})`
        : `${guest.name} اعتذر عن الحضور`,
      error: waResult?.error || null,
      createdAt: new Date().toISOString(),
    });
  });

  return NextResponse.json({ guest });
}
