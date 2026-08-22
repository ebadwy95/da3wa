import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export async function GET(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const event = db.events.find((e) => e.id === id);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  const guestCount = db.guests.filter((g) => g.eventId === id).length;
  return NextResponse.json({ event: { ...event, guestCount, remaining: Math.max(0, event.packageLimit - guestCount) } });
}

// Update event details / upgrade the package limit.
export async function PATCH(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود" };

    const editable = [
      "coupleNames",
      "eventDate",
      "venueName",
      "venueAddress",
      "venueMapUrl",
      "welcomeMessage",
      "packageLimit",
    ];
    for (const key of editable) {
      if (body[key] !== undefined) {
        event[key] = key === "packageLimit" ? Math.max(1, parseInt(body[key], 10) || event.packageLimit) : body[key];
      }
    }
    return { event };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ event: result.event });
}

export async function DELETE(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  await withDb((db) => {
    db.events = db.events.filter((e) => e.id !== id);
    db.guests = db.guests.filter((g) => g.eventId !== id);
    db.messages = db.messages.filter((m) => m.eventId !== id);
  });
  return NextResponse.json({ ok: true });
}
