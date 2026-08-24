import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { sendMail } from "@/lib/mail";
import { EVENT_TYPES, eventTypeLabel } from "@/lib/eventTypes";

// Enquiries from the public form at /start.
//
// The enquiry is written to the database FIRST and the email sent afterwards,
// deliberately. Mail is the part that can fail — a wrong password, a provider
// outage, credentials not configured yet — and a lead that only existed inside
// an email that never sent is a lead that never existed. Stored first, it is
// always in the dashboard even when nothing was delivered.

const ENQUIRY_TO = process.env.ENQUIRY_EMAIL || "hello@da3wa.digital";
const MAX = { name: 80, phone: 25, email: 120, venue: 120, notes: 1500 };

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  const name = clean(body.name, MAX.name);
  const phoneRaw = clean(body.phone, MAX.phone);
  const email = clean(body.email, MAX.email);
  const eventType = EVENT_TYPES.some((t) => t.id === body.eventType) ? body.eventType : "";
  const eventDate = clean(body.eventDate, 10);
  const guestCount = clean(body.guestCount, 8);
  const notes = clean(body.notes, MAX.notes);

  if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  if (!eventType) return NextResponse.json({ error: "اختر نوع المناسبة" }, { status: 400 });

  // Same rule the guest list enforces: a number without a country code is
  // ambiguous across the countries this serves, so it's rejected rather than
  // guessed at.
  const phone = normalizePhone(phoneRaw);
  if (!phone.valid) {
    return NextResponse.json({ error: `رقم التواصل غير صالح: ${phone.error}` }, { status: 400 });
  }

  const enquiry = {
    id: randomUUID(),
    name,
    phone: phone.e164,
    email,
    eventType,
    eventTypeLabel: eventTypeLabel(eventType),
    eventDate,
    guestCount,
    notes,
    status: "new",
    createdAt: new Date().toISOString(),
  };

  await withDb((db) => {
    db.enquiries = db.enquiries || [];
    db.enquiries.unshift(enquiry);
    // Bounded, like the check-in log — this is a notification inbox, not an
    // archive, and the email carries a copy anyway.
    db.enquiries = db.enquiries.slice(0, 500);
  });

  const lines = [
    `طلب مناسبة جديد من ${enquiry.name}`,
    "",
    `النوع        : ${enquiry.eventTypeLabel}`,
    `رقم التواصل  : ${enquiry.phone}`,
    enquiry.email ? `البريد       : ${enquiry.email}` : null,
    enquiry.eventDate ? `التاريخ      : ${enquiry.eventDate}` : null,
    enquiry.guestCount ? `عدد الضيوف   : ${enquiry.guestCount}` : null,
    "",
    enquiry.notes ? `تفاصيل:\n${enquiry.notes}` : "(بدون تفاصيل إضافية)",
  ].filter((l) => l !== null);

  const mail = await sendMail({
    to: ENQUIRY_TO,
    subject: `طلب ${enquiry.eventTypeLabel} — ${enquiry.name}`,
    text: lines.join("\n"),
    replyTo: enquiry.email || undefined,
  });

  if (mail.error) {
    // The enquiry is safely stored; say so rather than telling someone their
    // request failed when it didn't.
    console.error("[enquiries] stored but not emailed:", mail.error);
  }

  return NextResponse.json({ ok: true, id: enquiry.id });
}

// Admin-only: the enquiries inbox shown in the dashboard.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const db = await getDb();
  return NextResponse.json({ enquiries: db.enquiries || [] });
}
