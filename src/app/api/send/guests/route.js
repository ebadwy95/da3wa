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
import { guestKind } from "@/lib/guestKind";
import { syncEventDeliveries, undeliveredGuests } from "@/lib/delivery";

// The sending app's list: this side's guests (and anyone not yet given a
// side, so nobody falls between the two lists), each with where they stand
// and the WhatsApp link for their invitation.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSenderSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  // The verdicts matter more here than anywhere else: a guest the business
  // number was refused for is exactly the one this app exists to reach. Wati's
  // plan sends no delivery webhooks, so the statuses are pulled in on a read;
  // it throttles itself and is safe on every poll.
  await syncEventDeliveries(session.eventId).catch(() => {});

  const db = await getDb();
  const event = db.events.find((e) => e.id === session.eventId);
  const now = new Date();
  const refused = undeliveredGuests(db, event.id);

  const guests = db.guests
    .filter((g) => g.eventId === event.id && (!g.side || g.side === session.side))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phoneDisplay || g.phone,
      language: g.language || "ar",
      side: g.side || null,
      kind: guestKind(g),
      stage: guestStage(g),
      seats: g.status === "confirmed" ? 1 + (g.confirmedCompanions || 0) : null,
      maxGuests: 1 + (g.maxCompanions || 0),
      // The count can change until the invitation goes out.
      sizeEditable: guestKind(g) === "invite" && !g.handSend?.invite && !g.invitedAt && !g.openedAt && g.status === "pending",
      // When رقم دعوة sent them the "you haven't answered yet" reminder. The
      // couple need to tell apart a guest nobody has chased from one who has
      // been reminded and still said nothing — only the second needs a call.
      nudgedAt: g.nudgeSentAt || null,
      // Set when WhatsApp refused a message to this guest and they haven't
      // opened their link since — the business number can't reach them, so
      // this app is the only way they get their invitation.
      undelivered: refused.get(g.id) || null,
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
