import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCoupleEventId, createCoupleSession, clearCoupleSession } from "@/lib/coupleAuth";

// Login for the couple themselves at /couple — separate from both the
// platform admin password and the door-scanner code. Scoped to exactly one
// event: a couple can never see or touch another couple's wedding.
export async function GET() {
  const eventId = await getCoupleEventId();
  if (!eventId) return NextResponse.json({ authed: false });

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ authed: false });

  return NextResponse.json({
    authed: true,
    event: { id: event.id, coupleNames: event.coupleNames },
    mustChangePassword: Boolean(event.mustChangePassword),
  });
}

export async function POST(request) {
  const { username, password } = await request.json().catch(() => ({}));
  const cleanUsername = String(username || "").trim();
  if (!cleanUsername || !password) {
    return NextResponse.json({ error: "يجب إدخال اسم المستخدم وكلمة المرور" }, { status: 400 });
  }

  const db = await getDb();
  const event = db.events.find(
    (e) => e.coupleUsername === cleanUsername && e.couplePassword === password
  );
  if (!event) {
    return NextResponse.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
  }

  await createCoupleSession(event.id);

  return NextResponse.json({
    ok: true,
    event: { id: event.id, coupleNames: event.coupleNames },
    mustChangePassword: Boolean(event.mustChangePassword),
  });
}

export async function DELETE() {
  await clearCoupleSession();
  return NextResponse.json({ ok: true });
}
