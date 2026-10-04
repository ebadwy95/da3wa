import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { verifyGuestPageToken } from "@/lib/token";

// "The guest opened their entry pass / thank-you card." Called from the page
// itself, in the browser, after it loads: WhatsApp fetches every link it
// shows a preview for, and that visit must not count as the guest's. A
// preview fetch reads the HTML; it never runs the page's script.
const FIELD = { pass: "passViewedAt", thanks: "thanksViewedAt" };

export async function POST(request) {
  const { guestId, purpose, t } = await request.json().catch(() => ({}));
  const field = FIELD[purpose];
  if (!field || !verifyGuestPageToken(guestId, purpose, t)) {
    return NextResponse.json({ error: "رابط غير صالح" }, { status: 403 });
  }
  await withDb((db) => {
    const guest = db.guests.find((g) => g.id === guestId);
    if (guest && !guest[field]) guest[field] = new Date().toISOString();
  });
  return NextResponse.json({ ok: true });
}
