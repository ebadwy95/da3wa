import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { getSenderSession } from "@/lib/senderAuth";
import { STEPS } from "@/lib/handSend";

// Records that a message's button was pressed — WhatsApp was opened with it
// written out. `undo` takes it back, for the times it wasn't actually sent.
//
// The invitation also sets invitedAt, the field the dashboards and the
// reminder job already read, so a hand-sent invitation counts as sent
// everywhere without them knowing which route it took.
export async function POST(request) {
  const session = await getSenderSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { guestId, step, undo } = await request.json().catch(() => ({}));
  if (!STEPS.includes(step)) return NextResponse.json({ error: "خطوة غير معروفة" }, { status: 400 });

  const ok = await withDb((db) => {
    const guest = db.guests.find(
      (g) => g.id === guestId && g.eventId === session.eventId && (!g.side || g.side === session.side)
    );
    if (!guest) return false;
    guest.handSend = guest.handSend || {};
    if (undo) {
      delete guest.handSend[step];
      if (step === "invite" && guest.invitedVia === "hand") {
        guest.invitedAt = null;
        guest.invitedVia = null;
      }
    } else {
      guest.handSend[step] = new Date().toISOString();
      if (step === "invite" && !guest.invitedAt) {
        guest.invitedAt = guest.handSend.invite;
        guest.invitedVia = "hand";
      }
    }
    return true;
  });
  if (!ok) return NextResponse.json({ error: "الضيف غير موجود" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
