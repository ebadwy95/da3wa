import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { canAccessEvent } from "@/lib/coupleAuth";
import { isAdminAuthed } from "@/lib/auth";
import { resolveGuard, guardLink } from "@/lib/security";
import { siteOrigin } from "@/lib/seo";
import { coupleNamesIn } from "@/lib/couple";
import {
  sendTemplateMessage,
  messagingIsConfigured,
  isUsableTemplateName,
  describeTemplateProblem,
  templateNameFor,
} from "@/lib/messaging";

// Sending a staff member their own way in, from رقم دعوة.
//
// Until now the admin pressed a wa.me link and sent it from their own phone,
// which works and looks like it: a personal number, at midnight, with a link
// in it. From the wedding's own number it reads as what it is, and the person
// on the door has it in the same thread as everything else from دعوة.
//
// Two kinds, one message. A security contact's link is their credential, so
// it carries no code; a door scanner's link carries the code in it (?c=), so
// nobody has to type eight characters off a screenshot at the gate.
export const dynamic = "force-dynamic";

async function mayInvite(eventId, guardKey) {
  if (await isAdminAuthed()) return true;
  if (await canAccessEvent(eventId)) return true;
  if (guardKey) {
    const guard = resolveGuard(await getDb(), guardKey);
    if (guard?.event?.id === eventId) return true;
  }
  return false;
}

export async function POST(request, { params }) {
  const { id: eventId } = await params;
  const body = await request.json().catch(() => ({}));
  if (!(await mayInvite(eventId, body?.key))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const templateName = templateNameFor("STAFF");
  if (messagingIsConfigured() && !isUsableTemplateName(templateName)) {
    return NextResponse.json(
      {
        error:
          "قالب دعوة فريق العمل غير مضبوط — اضبط WHATSAPP_STAFF_TEMPLATE_NAME على da3wa_staff_access بعد اعتماده من Meta",
      },
      { status: 503 }
    );
  }
  // Asked once, up front, so an unapproved template says so in one sentence
  // instead of failing with an opaque 400 per person.
  const problem = await describeTemplateProblem(templateName);
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });

  let person = null;
  let link = null;
  if (body?.kind === "guard") {
    person = (event.securityContacts || []).find((c) => c.id === body?.personId);
    if (person) link = guardLink(event.id, person.id);
  } else if (body?.kind === "scanner") {
    person = (event.scanners || []).find((s) => s.id === body?.personId);
    // The code travels in the link: the staff member taps once and only types
    // their own name. A code read off a screenshot at a gate is a typo.
    if (person) link = `${siteOrigin()}/scan?c=${encodeURIComponent(person.code)}`;
  } else {
    return NextResponse.json({ error: "نوع غير معروف" }, { status: 400 });
  }

  if (!person) return NextResponse.json({ error: "الشخص غير موجود" }, { status: 404 });
  if (!person.name) return NextResponse.json({ error: "اكتب اسمه أولًا" }, { status: 400 });
  if (!person.phone) {
    return NextResponse.json({ error: `اكتب رقم واتساب ${person.name} أولًا` }, { status: 400 });
  }

  const waResult = await sendTemplateMessage({
    phone: person.phone,
    templateName,
    broadcastName: "da3wa_staff_access",
    params: [
      { name: "name", value: person.name },
      { name: "couple", value: coupleNamesIn(event, "ar") },
      { name: "link", value: link },
    ],
  });

  await withDb((fresh) => {
    fresh.messages = fresh.messages || [];
    fresh.messages.push({
      id: randomUUID(),
      eventId,
      guestId: null,
      guestName: person.name,
      phone: person.phone,
      type: "staff_access",
      status: waResult.simulated ? "simulated" : waResult.error ? "failed" : "sent",
      waMessageId: waResult.messageId || null,
      content:
        body.kind === "guard"
          ? `تم إرسال رابط تنبيهات الأمن إلى ${person.name}`
          : `تم إرسال رابط السكانر إلى ${person.name}`,
      error: waResult.error || null,
      createdAt: new Date().toISOString(),
    });
  });

  if (waResult.error) return NextResponse.json({ error: waResult.error }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: person.name, simulated: Boolean(waResult.simulated) });
}
