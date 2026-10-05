import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

// Admin: whether Da3wa's own WhatsApp number sends this wedding's automatic
// messages — the entry pass on confirming, the reminder two days before and
// the thank-you the day after. Off when the couple send by hand from their
// own WhatsApp: the guest's pass is on their invitation link, and a message
// from a number they don't know only confuses them.
export async function PUT(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const { on } = await request.json().catch(() => ({}));
  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return null;
    event.autoMessagesOff = !on;
    return { autoMessagesOff: event.autoMessagesOff };
  });
  if (!result) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  return NextResponse.json(result);
}
