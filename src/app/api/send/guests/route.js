import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSenderSession } from "@/lib/senderAuth";
import {
  guestStage,
  inviteMessage,
  thanksMessage,
  thanksState,
  thanksOpen,
  whatsappLink,
} from "@/lib/handSend";

// The sending app's list: this side's guests (and anyone not yet given a
// side, so nobody falls between the two lists), each with where they stand
// and the WhatsApp link for their invitation.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSenderSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const db = await getDb();
  const event = db.events.find((e) => e.id === session.eventId);
  const now = new Date();

  const guests = db.guests
    .filter((g) => g.eventId === event.id && (!g.side || g.side === session.side))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phoneDisplay || g.phone,
      language: g.language || "ar",
      side: g.side || null,
      stage: guestStage(g),
      seats: g.status === "confirmed" ? 1 + (g.confirmedCompanions || 0) : null,
      maxGuests: 1 + (g.maxCompanions || 0),
      // The count can change until the invitation goes out.
      sizeEditable: !g.handSend?.invite && !g.invitedAt && !g.openedAt && g.status === "pending",
      link: whatsappLink(g.phoneDisplay || g.phone, inviteMessage(g, event)),
      thanks: thanksState(g, event, now),
      thanksLink: whatsappLink(g.phoneDisplay || g.phone, thanksMessage(g, event)),
    }));

  return NextResponse.json({
    event: { id: event.id, coupleNames: event.coupleNames },
    side: session.side,
    thanksOpen: thanksOpen(event, now),
    guests,
  });
}
