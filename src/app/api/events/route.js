import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

function withCounts(event, guests) {
  const eventGuests = guests.filter((g) => g.eventId === event.id);
  return {
    ...event,
    guestCount: eventGuests.length,
    remaining: Math.max(0, event.packageLimit - eventGuests.length),
  };
}

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const db = await getDb();
  const events = db.events
    .map((e) => withCounts(e, db.guests))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return NextResponse.json({ events });
}

export async function POST(request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { groomPhone, coupleNames, eventDate, venueName, venueAddress, venueMapUrl, welcomeMessage, packageLimit } = body;

  // Required: every event MUST be tied to the groom/couple's phone number —
  // it's the only identifier we have for a wedding before real per-couple
  // accounts exist.
  if (!groomPhone) {
    return NextResponse.json({ error: "رقم العريس مطلوب لإنشاء أي فرح جديد" }, { status: 400 });
  }
  const phone = normalizePhone(groomPhone);
  if (!phone.valid) {
    return NextResponse.json({ error: `رقم العريس غير صالح: ${phone.error}` }, { status: 400 });
  }
  if (!coupleNames) {
    return NextResponse.json({ error: "اسم العروسين مطلوب" }, { status: 400 });
  }

  const event = {
    id: randomUUID(),
    groomPhone: phone.digits,
    groomPhoneDisplay: phone.e164,
    coupleNames: String(coupleNames).trim(),
    eventDate: eventDate || "",
    venueName: venueName || "",
    venueAddress: venueAddress || "",
    venueMapUrl: venueMapUrl || "",
    welcomeMessage:
      welcomeMessage ||
      "يتشرف بدعوتكم لحضور حفل زفافهم، ونتطلع لمشاركتكم هذه الليلة السعيدة.",
    // Invite-count package the couple paid for. Set by the platform admin
    // based on what was agreed with the couple — not self-serve yet.
    packageLimit: Math.max(1, parseInt(packageLimit, 10) || 100),
    createdAt: new Date().toISOString(),
  };

  await withDb((db) => {
    db.events.push(event);
  });

  return NextResponse.json({ event: withCounts(event, []) }, { status: 201 });
}
