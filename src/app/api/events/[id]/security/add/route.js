import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";
import { resolveGuard, MAX_SECURITY_CONTACTS, guardLink } from "@/lib/security";
import { normalizePhone } from "@/lib/phone";

// One more person on the security team, added from inside the team.
//
// The head of security is the one standing there at nine in the evening
// realising they are a man short, not the admin asleep at home. Their own key
// is what authorises it — the same key that already rings their phone for
// this wedding and lets them answer for it.
//
// Deliberately add-only. Removing someone is how a key gets quietly taken
// away from a person who should still have it, so that stays with the admin.
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { id: eventId } = await params;
  const body = await request.json().catch(() => ({}));

  let allowed = (await isAdminAuthed()) || (await canAccessEvent(eventId));
  if (!allowed && body?.key) {
    const guard = resolveGuard(await getDb(), body.key);
    allowed = guard?.event?.id === eventId;
  }
  if (!allowed) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const name = String(body?.name || "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "اكتب اسمه" }, { status: 400 });
  const phone = normalizePhone(String(body?.phone || "").trim());
  if (!phone.valid) return NextResponse.json({ error: phone.error }, { status: 400 });

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return { error: "الزفاف غير موجود", status: 404 };
    event.securityContacts = event.securityContacts || [];
    if (event.securityContacts.some((c) => c.phone === phone.e164)) {
      return { error: "هذا الرقم موجود في الفريق", status: 409 };
    }
    if (event.securityContacts.length >= MAX_SECURITY_CONTACTS) {
      return { error: `الحد الأقصى ${MAX_SECURITY_CONTACTS} أشخاص`, status: 409 };
    }
    const contact = { id: randomUUID(), name, phone: phone.e164 };
    event.securityContacts.push(contact);
    return { contact };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    contact: { ...result.contact, link: guardLink(eventId, result.contact.id) },
  });
}
