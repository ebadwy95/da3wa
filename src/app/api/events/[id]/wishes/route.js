import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";

// Public: lets a guest see the full "wall" of well-wish messages other
// guests of the SAME wedding have left — not just their own. Access is
// still gated: the caller must hold a valid invite token for one specific
// guest of this event (their own personal invite link), proving they're
// actually a real invited guest of this wedding before they can browse
// everyone else's messages. No phone numbers or other guest details are
// returned here — just names and messages.
export async function GET(request, { params }) {
  const { id: eventId } = await params;
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get("guestId");
  const token = searchParams.get("t");

  if (!verifyInviteToken(guestId, token)) {
    return NextResponse.json({ error: "رابط الدعوة غير صالح" }, { status: 403 });
  }

  const db = await getDb();
  const requestingGuest = db.guests.find((g) => g.id === guestId);
  if (!requestingGuest || requestingGuest.eventId !== eventId) {
    return NextResponse.json({ error: "رابط الدعوة غير صالح" }, { status: 403 });
  }

  const wishes = db.guests
    .filter((g) => g.eventId === eventId && g.wishMessage)
    .map((g) => ({ name: g.name, wishMessage: g.wishMessage, wishMessageAt: g.wishMessageAt }))
    .sort((a, b) => new Date(b.wishMessageAt || 0) - new Date(a.wishMessageAt || 0));

  return NextResponse.json({ wishes });
}
