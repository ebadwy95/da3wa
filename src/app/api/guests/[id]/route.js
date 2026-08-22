import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { verifyInviteToken } from "@/lib/token";
import { isAdminAuthed } from "@/lib/auth";

// Public: a guest opening their personal invite link. Requires a valid
// signed token — no auth cookie needed, but the token gates access.
export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t");

  const db = await getDb();
  const guest = db.guests.find((g) => g.id === id);
  if (!guest) {
    return NextResponse.json({ error: "الدعوة غير موجودة" }, { status: 404 });
  }

  const admin = await isAdminAuthed();
  if (!admin && !verifyInviteToken(id, token)) {
    return NextResponse.json({ error: "رابط الدعوة غير صالح" }, { status: 403 });
  }

  const event = db.events.find((e) => e.id === guest.eventId) || null;
  return NextResponse.json({ guest, event });
}

export async function DELETE(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  await withDb((db) => {
    db.guests = db.guests.filter((g) => g.id !== id);
  });
  return NextResponse.json({ ok: true });
}
