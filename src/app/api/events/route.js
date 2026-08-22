import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { generateScannerCode, generateCoupleUsername, generateCouplePassword } from "@/lib/token";

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
  // Backfill: events created before the per-event scanner-code / couple-login
  // features existed won't have them yet — generate and persist on first
  // read so every event (old or new) always has both to show/share.
  const needsBackfill = (await getDb()).events.some(
    (e) => !e.scannerCode || !e.coupleUsername || !e.couplePassword
  );
  const db = needsBackfill
    ? await withDb((db) => {
        db.events.forEach((e) => {
          if (!e.scannerCode) e.scannerCode = generateScannerCode();
          if (!e.coupleUsername) e.coupleUsername = generateCoupleUsername();
          if (!e.couplePassword) {
            e.couplePassword = generateCouplePassword();
            e.mustChangePassword = true;
          }
        });
        return db;
      })
    : await getDb();
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
    return NextResponse.json({ error: "رقم العريس مطلوب لإنشاء أي زفاف جديد" }, { status: 400 });
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
    // Lets THIS event's door staff log into /scan without the platform
    // admin password, and without being able to check in another event's
    // guests — see src/app/api/scan-auth/route.js.
    scannerCode: generateScannerCode(),
    // Lets the couple themselves log into /couple and manage ONLY their own
    // event (add guests, send invites, see stats) without the platform
    // admin password and without seeing any other couple's event. Stored in
    // plain text on the event record — same simplicity level as
    // ADMIN_PASSWORD elsewhere in this app; fine for this stage, worth
    // revisiting if/when this becomes a bigger multi-tenant product.
    coupleUsername: generateCoupleUsername(),
    couplePassword: generateCouplePassword(),
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };

  await withDb((db) => {
    db.events.push(event);
  });

  return NextResponse.json({ event: withCounts(event, []) }, { status: 201 });
}
