import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { canAccessEvent } from "@/lib/coupleAuth";

// Marks one guest as invited, or un-marks them.
//
// This is what the hand-send flow writes when the couple sends an invitation
// from their own WhatsApp. `invitedAt` is the same field the API send path
// sets, so the guest table, the counts and the reminder cron all keep working
// without knowing which route the message actually took.
//
// Un-marking exists because the couple is the one deciding. The flow marks a
// guest as sent the moment it hands them to WhatsApp — that is optimistic, and
// on two hundred guests optimistic is right, because a confirmation tap per
// guest doubles a job that is already long. What it needs instead is a way to
// say "no, that one didn't go", which is this.
export async function POST(request, { params }) {
  const { id: eventId } = await params;
  if (!(await canAccessEvent(eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { guestId, sent = true } = body;
  if (!guestId) {
    return NextResponse.json({ error: "guestId مطلوب" }, { status: 400 });
  }

  const result = await withDb((db) => {
    const guest = db.guests.find((g) => g.id === guestId && g.eventId === eventId);
    if (!guest) return { error: "الضيف غير موجود" };
    guest.invitedAt = sent ? new Date().toISOString() : null;
    return { guest };
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ guest: result.guest });
}
