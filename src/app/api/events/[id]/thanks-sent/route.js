import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

// Records that a thank-you went out to these guests in one broadcast.
//
// The broadcast itself is sent from the provider's own console, so nothing
// in this app sees it happen. Without this, the morning after the wedding
// the couple open the sending app's "باقي الشكر" list and find every guest
// they have, nearly all of them already thanked — and the handful who
// actually still need a message are lost in the middle of it.
//
// Admin-only, and it only ever writes the stamp the automatic thank-you
// would have written. Sending a second thank-you by hand is still possible;
// this just stops the list from asking for it.
export async function POST(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id: eventId } = await params;
  const { guestIds, undo } = await request.json().catch(() => ({}));
  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: "لا توجد أسماء" }, { status: 400 });
  }

  const wanted = new Set(guestIds);
  const stamp = new Date().toISOString();

  const changed = await withDb((db) => {
    let n = 0;
    for (const g of db.guests || []) {
      if (g.eventId !== eventId || !wanted.has(g.id)) continue;
      if (undo === true) {
        if (g.thanksSentAt) {
          g.thanksSentAt = null;
          n += 1;
        }
      } else if (!g.thanksSentAt) {
        g.thanksSentAt = stamp;
        n += 1;
      }
    }
    return n;
  });

  return NextResponse.json({ changed, of: guestIds.length });
}
