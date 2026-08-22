import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { makeInviteToken } from "@/lib/token";
import { normalizePhone } from "@/lib/phone";

function guestWithLink(guest) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const token = makeInviteToken(guest.id);
  return { ...guest, inviteLink: `${base}/invite/${guest.id}?t=${token}` };
}

export async function GET(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id: eventId } = await params;
  const db = await getDb();
  const guests = db.guests.filter((g) => g.eventId === eventId).map(guestWithLink);
  return NextResponse.json({ guests });
}

export async function POST(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id: eventId } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, phone, maxCompanions, force } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "الاسم ورقم الواتساب مطلوبين" }, { status: 400 });
  }
  const parsedPhone = normalizePhone(phone);
  if (!parsedPhone.valid) {
    return NextResponse.json({ error: parsedPhone.error }, { status: 400 });
  }

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return { error: "الفرح غير موجود", status: 404 };

    const currentCount = db.guests.filter((g) => g.eventId === eventId).length;
    if (currentCount >= event.packageLimit && !force) {
      // Soft block: caller must explicitly pass force:true to add anyway,
      // or contact the platform admin to upgrade the package first.
      return {
        limitReached: true,
        packageLimit: event.packageLimit,
        guestCount: currentCount,
      };
    }

    const guest = {
      id: randomUUID(),
      eventId,
      name: String(name).trim(),
      phone: parsedPhone.digits,
      phoneDisplay: parsedPhone.e164,
      maxCompanions: Math.max(0, parseInt(maxCompanions, 10) || 0),
      status: "pending",
      confirmedCompanions: null,
      checkedIn: false,
      checkedInAt: null,
      qrDataUrl: null,
      invitedAt: null,
      createdAt: new Date().toISOString(),
    };
    db.guests.push(guest);
    return { guest };
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }
  if (result.limitReached) {
    return NextResponse.json(
      {
        limitReached: true,
        message: `وصلت لحد الباكدج (${result.packageLimit} دعوة) — تقدر تضيف الضيف ده برضو (زيادة عن الباكدج) أو تكلم الإدارة عشان ترفّع الباكدج`,
        packageLimit: result.packageLimit,
        guestCount: result.guestCount,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ guest: guestWithLink(result.guest) }, { status: 201 });
}
