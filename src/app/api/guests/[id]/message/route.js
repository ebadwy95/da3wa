import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";
import { isAdminAuthed } from "@/lib/auth";

// Public: a guest leaving (or updating) a short well-wish message for the
// couple from their own invite page — separate from confirming/declining
// attendance, and allowed regardless of that status. Gated by the same
// signed invite token as the rest of the invite page, so only the guest
// holding their own link can post under their name.
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { token, message } = body;

  const admin = await isAdminAuthed();
  if (!admin && !verifyInviteToken(id, token)) {
    return NextResponse.json({ error: "رابط الدعوة غير صالح" }, { status: 403 });
  }

  const clean = String(message || "").trim().slice(0, 500);
  if (!clean) {
    return NextResponse.json({ error: "لا يمكن إرسال رسالة فارغة" }, { status: 400 });
  }

  const result = await withDb((db) => {
    const guest = db.guests.find((g) => g.id === id);
    if (!guest) return { error: "الضيف غير موجود" };
    guest.wishMessage = clean;
    guest.wishMessageAt = new Date().toISOString();
    return { guest };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ guest: result.guest });
}
