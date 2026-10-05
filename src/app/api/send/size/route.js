import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { getSenderSession } from "@/lib/senderAuth";

// The groom or the bride changing how many people a guest's invitation is
// for, from the sending app — only before it has been sent. After that the
// guest may already be looking at a card that says the old number. The guest
// record is the one every screen reads, so the change shows everywhere.
export async function POST(request) {
  const session = await getSenderSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { guestId, maxGuests } = await request.json().catch(() => ({}));
  const total = Math.max(1, Math.min(30, parseInt(maxGuests, 10) || 1));

  const result = await withDb((db) => {
    const guest = db.guests.find(
      (g) => g.id === guestId && g.eventId === session.eventId && (!g.side || g.side === session.side)
    );
    if (!guest) return { error: "الضيف غير موجود", status: 404 };
    if (guest.handSend?.invite || guest.invitedAt || guest.openedAt || guest.status !== "pending") {
      return { error: "الدعوة انرسلت — ما يصير تغيير العدد بعدها", status: 409 };
    }
    guest.maxCompanions = total - 1;
    return { maxGuests: total };
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
