import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseFloorKey } from "@/lib/token";
import { guestKind } from "@/lib/guestKind";
import { isWithdrawn } from "@/lib/roll";

// How full the hall is, right now.
//
// The one number a wedding planner stands there waiting for: not how many
// were invited, not how many replied — how many people are inside at this
// moment. They hold the start of the night on it.
//
// Read-only and deliberately thin: no names, no phones, no links. The key in
// the path is the whole authorisation, so the link can be handed to the
// planner, the caterer and the hall manager without handing over the guest
// list with it.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { key } = await params;
  const parsed = parseFloorKey(key);
  if (!parsed) return NextResponse.json({ error: "رابط غير صالح" }, { status: 403 });

  const db = await getDb();
  const event = (db.events || []).find((e) => e.id === parsed.eventId);
  if (!event) return NextResponse.json({ error: "المناسبة غير موجودة" }, { status: 404 });

  // Only the guests who hold a scannable pass: the ones who confirmed and are
  // still on the roll. "أهل الفرح" and "مشاركة الفرحة" never pass the scanner,
  // so counting them here would promise the planner arrivals that can never
  // register.
  const guests = (db.guests || []).filter(
    (g) =>
      g.eventId === event.id &&
      !isWithdrawn(g) &&
      guestKind(g) === "invite" &&
      g.status === "confirmed"
  );

  const blank = () => ({ expected: 0, inside: 0, outside: 0, arrivedCards: 0, cards: 0 });
  const tally = { groom: blank(), bride: blank() };

  for (const g of guests) {
    const row = tally[g.side === "bride" ? "bride" : "groom"];
    row.expected += 1 + (g.confirmedCompanions || 0);
    row.inside += g.checkedInCount || 0;
    row.outside += g.steppedOutCount || 0;
    row.cards += 1;
    if ((g.checkedInCount || 0) > 0 || (g.steppedOutCount || 0) > 0) row.arrivedCards += 1;
  }

  const sum = (f) => tally.groom[f] + tally.bride[f];

  // When each party first came through, so the screen can show how fast the
  // hall is filling and when it is likely to be full. Only the arrival times
  // — nothing that identifies who arrived.
  const arrivals = guests
    .filter((g) => g.checkedInAt)
    .map((g) => new Date(g.checkedInAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  return NextResponse.json({
    coupleNames: event.coupleNames,
    eventDate: event.eventDate,
    eventTime: event.eventTime,
    venueName: event.venueName,
    groom: tally.groom,
    bride: tally.bride,
    total: {
      expected: sum("expected"),
      inside: sum("inside"),
      outside: sum("outside"),
      arrivedCards: sum("arrivedCards"),
      cards: sum("cards"),
    },
    arrivals,
    now: Date.now(),
  });
}
