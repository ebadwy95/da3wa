import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";
import { generateGuestQr } from "@/lib/qr";
import { sendTemplateMessage, watiIsConfigured, isUsableTemplateName } from "@/lib/wati";

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
      coupleNames: event?.coupleNames || "",
    };
  });

  if (outcome.error) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status || 400 });
  }

  const { guest, coupleNames } = outcome;

  // 2. Send the QR over WhatsApp — outside any transaction, so a retry can
  //    never send it twice.
  //
  //    If the QR template name is missing we skip the send rather than fall
  //    back to a default name (this used to send Meta's "hello_world" sample
  //    to real guests). The guest's confirmation still stands and their QR is
  //    already on their invite page — only the WhatsApp copy is missing, and
  //    the admin feed says exactly why.
  const qrTemplateName = process.env.WATI_QR_TEMPLATE_NAME;
  let waResult = null;
  if (attending && watiIsConfigured() && !isUsableTemplateName(qrTemplateName)) {
    waResult = {
      error:
        "لم يُرسَل رمز QR على واتساب: WATI_QR_TEMPLATE_NAME غير مضبوط على قالب معتمد (اضبطه على da3wa_qr_delivery بعد اعتماده من Meta)",
    };
  } else if (attending) {
    waResult = await sendTemplateMessage({
      phone: guest.phoneDisplay || guest.phone,
      templateName: qrTemplateName || "da3wa_qr",
      broadcastName: "da3wa_qr_delivery",
      params: [
        { name: "name", value: guest.name },
        { name: "couple", value: coupleNames },
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
      content: attending
        ? `تم إرسال كود QR للدخول إلى ${guest.name} (${guest.phoneDisplay || guest.phone})`
        : `${guest.name} اعتذر عن الحضور`,
      error: waResult?.error || null,
      createdAt: new Date().toISOString(),
    });
  });

  return NextResponse.json({ guest });
}
