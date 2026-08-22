import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { makeInviteToken } from "@/lib/token";
import { sendTemplateMessage } from "@/lib/wati";

// One-click bulk send: sends the "you're invited, tap to confirm" message
// (a Meta-approved template with the guest's personal link) to every guest
// in this event who hasn't been sent one yet. Guests added later (or a
// second click) only message the new/un-sent ones — safe to click again.
export async function POST(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id: eventId } = await params;
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const templateName = process.env.WATI_INVITE_TEMPLATE_NAME || "hello_world";

  const db = await import("@/lib/db").then((m) => m.getDb());
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ error: "الفرح غير موجود" }, { status: 404 });

  const pendingGuests = db.guests.filter((g) => g.eventId === eventId && !g.invitedAt);

  if (pendingGuests.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: "كل الضيوف اتبعتلهم الدعوة قبل كده" });
  }

  let sent = 0;
  let failed = 0;

  // Sequential on purpose — respects Wati's per-account send-rate limits
  // and keeps a clean, ordered log in the feed.
  for (const guest of pendingGuests) {
    const link = `${base}/invite/${guest.id}?t=${makeInviteToken(guest.id)}`;
    const waResult = await sendTemplateMessage({
      phone: guest.phoneDisplay || guest.phone,
      templateName,
      broadcastName: "da3wa_invite_link",
      params: [
        { name: "name", value: guest.name },
        { name: "link", value: link },
      ],
    });

    const status = waResult.simulated ? "simulated" : waResult.error ? "failed" : "sent";
    if (status === "sent" || status === "simulated") sent++;
    else failed++;

    await withDb((freshDb) => {
      const g = freshDb.guests.find((x) => x.id === guest.id);
      if (g) g.invitedAt = new Date().toISOString();
      freshDb.messages.push({
        id: randomUUID(),
        eventId,
        guestId: guest.id,
        guestName: guest.name,
        phone: guest.phoneDisplay || guest.phone,
        type: "invite_sent",
        status,
        content: `تم إرسال رابط الدعوة إلى ${guest.name}`,
        error: waResult.error || null,
        createdAt: new Date().toISOString(),
      });
    });
  }

  return NextResponse.json({ sent, failed, total: pendingGuests.length });
}
