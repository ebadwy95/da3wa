import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { makeInviteToken } from "@/lib/token";
import { normalizePhone } from "@/lib/phone";
import { canAccessEvent } from "@/lib/coupleAuth";

function guestWithLink(guest) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const token = makeInviteToken(guest.id);
  return { ...guest, inviteLink: `${base}/invite/${guest.id}?t=${token}` };
}

export async function GET(request, { params }) {
  const { id: eventId } = await params;
  if (!(await canAccessEvent(eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const db = await getDb();
  const guests = db.guests.filter((g) => g.eventId === eventId).map(guestWithLink);
  return NextResponse.json({ guests });
}

export async function POST(request, { params }) {
  const { id: eventId } = await params;
  if (!(await canAccessEvent(eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { name, phone, maxGuests, force } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "الاسم ورقم الواتساب مطلوبين" }, { status: 400 });
  }
  const parsedPhone = normalizePhone(phone);
  if (!parsedPhone.valid) {
    return NextResponse.json({ error: parsedPhone.error }, { status: 400 });
  }

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return { error: "الزفاف غير موجود", status: 404 };

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

    // maxGuests is the TOTAL party size for this invite, guest included
    // (e.g. maxGuests=5 means this one guest plus up to 4 companions — not
    // 5 companions on top of them). We store it internally as maxCompanions
    // (companions beyond the guest themself) since that's what the invite
    // page's "how many companions are with you" selector and the QR
    // check-in math both consume directly.
    const parsedMaxGuests = Math.max(1, parseInt(maxGuests, 10) || 1);

    const guest = {
      id: randomUUID(),
      eventId,
      name: String(name).trim(),
      phone: parsedPhone.digits,
      phoneDisplay: parsedPhone.e164,
      maxCompanions: parsedMaxGuests - 1,
      status: "pending",
      confirmedCompanions: null,
      checkedIn: false,
      checkedInCount: 0,
      checkedInAt: null,
      lastCheckedInAt: null,
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
        message: `تم الوصول إلى الحد الأقصى للباقة (${result.packageLimit} دعوة) — يمكنك إضافة هذا الضيف رغم ذلك (زيادة عن حدود الباقة)، أو التواصل مع الإدارة لترقية الباقة`,
        packageLimit: result.packageLimit,
        guestCount: result.guestCount,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ guest: guestWithLink(result.guest) }, { status: 201 });
}
