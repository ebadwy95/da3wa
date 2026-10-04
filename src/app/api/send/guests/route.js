import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSenderSession } from "@/lib/senderAuth";
import {
  guestSteps,
  messageFor,
  whatsappLink,
  unlockDates,
  kuwaitToday,
  STEPS,
} from "@/lib/handSend";

// The sending app's list: this side's guests (and anyone not yet given a
// side, so nobody falls between the two lists), each with where their four
// messages stand and the WhatsApp link for the one that is due.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSenderSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const db = await getDb();
  const event = db.events.find((e) => e.id === session.eventId);
  const today = kuwaitToday();

  const guests = db.guests
    .filter((g) => g.eventId === event.id && (!g.side || g.side === session.side))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((g) => {
      const steps = guestSteps(g, event, today);
      const links = {};
      for (const step of STEPS) {
        if (["todo", "sent"].includes(steps[step].state)) {
          links[step] = whatsappLink(g.phoneDisplay || g.phone, messageFor(step, g, event));
        }
      }
      return {
        id: g.id,
        name: g.name,
        phone: g.phoneDisplay || g.phone,
        language: g.language || "ar",
        side: g.side || null,
        status: g.status,
        steps,
        links,
      };
    });

  return NextResponse.json({
    event: { id: event.id, coupleNames: event.coupleNames, eventDate: event.eventDate },
    side: session.side,
    ...unlockDates(event),
    today,
    guests,
  });
}
