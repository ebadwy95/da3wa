import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";
import { generateGuestQr } from "@/lib/qr";
import { sendTemplateMessage } from "@/lib/wati";

// Public endpoint: the guest confirms or declines from their invite page.
// Body: { token, attending: boolean, companions?: number }
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { token, attending, companions } = body;

  if (!verifyInviteToken(id, token)) {
    return NextResponse.json({ error: "رابط الدعوة غير صالح" }, { status: 403 });
  }

  const outcome = await withDb(async (db) => {
    const guest = db.guests.find((g) => g.id === id);
    if (!guest) return { error: "الضيف غير موجود", status: 404 };

    const clampedCompanions = Math.max(
      0,
      Math.min(guest.maxCompanions, parseInt(companions, 10) || 0)
    );

    guest.status = attending ? "confirmed" : "declined";
    guest.confirmedCompanions = attending ? clampedCompanions : 0;
    guest.respondedAt = new Date().toISOString();

    let waResult = null;
    let qr = null;

    if (attending) {
      qr = await generateGuestQr(guest.id);
      guest.qrDataUrl = qr.dataUrl;

      const templateName = process.env.WATI_QR_TEMPLATE_NAME || "hello_world";
      waResult = await sendTemplateMessage({
        phone: guest.phoneDisplay || guest.phone,
        templateName,
        broadcastName: "da3wa_qr_delivery",
        params: [{ name: "name", value: guest.name }],
      });
    }

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

    return { guest, qr };
  });

  if (outcome.error) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status || 400 });
  }

  return NextResponse.json({ guest: outcome.guest });
}
