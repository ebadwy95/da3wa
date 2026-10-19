import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { getSenderSession } from "@/lib/senderAuth";

// The groom or the bride taking a guest off their own list, from the sending
// app. Two different things, and the difference is what happens to the
// invitation already sitting on that guest's phone:
//
//   withdraw — off every count and off everything the system sends, but the
//              link still opens and tells them the invitation is closed.
//   delete   — gone, and the link dies with them.
//
// Scoped to this side's guests the same way the list is, so neither of them
// can reach across to the other's.
export async function POST(request) {
  const session = await getSenderSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { guestId, action } = await request.json().catch(() => ({}));
  if (action !== "withdraw" && action !== "delete") {
    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }

  const result = await withDb((db) => {
    const guest = db.guests.find(
      (g) => g.id === guestId && g.eventId === session.eventId && (!g.side || g.side === session.side)
    );
    if (!guest) return { error: "الضيف غير موجود", status: 404 };
    // An answer already given is the couple's to overrule from the wedding
    // dashboard, not something to lose by a mis-tap on a phone.
    if (guest.status !== "pending") {
      return { error: "هذا الضيف رد على الدعوة — عدّله من لوحة الزفاف", status: 409 };
    }
    if (action === "delete") {
      db.guests = db.guests.filter((g) => g.id !== guest.id);
      return { deleted: true };
    }
    guest.withdrawnAt = guest.withdrawnAt || new Date().toISOString();
    return { withdrawn: guest.withdrawnAt };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
