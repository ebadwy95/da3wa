import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";
import { computeDisplayStatus, isTodayOrFuture, daysSinceDeleted } from "@/lib/date";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!(await canAccessEvent(id))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const db = await getDb();
  const event = db.events.find((e) => e.id === id);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  const guestCount = db.guests.filter((g) => g.eventId === id).length;

  // The door-scanner codes stay admin-only info (shown inside the event's
  // details in /admin) — a couple session for this same event should not
  // receive them back in the API response at all.
  const admin = await isAdminAuthed();
  const { scanners, ...safeEvent } = event;

  return NextResponse.json({
    event: {
      ...safeEvent,
      ...(admin ? { scanners } : {}),
      guestCount,
      remaining: Math.max(0, event.packageLimit - guestCount),
      displayStatus: computeDisplayStatus(event),
    },
  });
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

// Soft delete only — never erases the wedding's data. The event moves to
// the admin's "الأرشيف" view and can be recalled (restored) for 30 days,
// see POST .../recall. After 30 days with no recall it simply stops
// appearing anywhere (see computeDisplayStatus / GET /api/events), but its
// data is kept, never actually removed.
export async function DELETE(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود" };
    event.status = "deleted";
    event.deletedAt = new Date().toISOString();
    return { event };
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}
