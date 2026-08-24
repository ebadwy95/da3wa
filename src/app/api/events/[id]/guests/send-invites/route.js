import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { makeInviteToken } from "@/lib/token";
import {
  sendTemplateMessage,
  watiIsConfigured,
  isUsableTemplateName,
  describeTemplateProblem,
} from "@/lib/wati";
import { canAccessEvent } from "@/lib/coupleAuth";
import { resolveCoupleParts } from "@/lib/couple";

// One-click bulk send: sends the "you're invited, tap to confirm" message
// (a Meta-approved template with the guest's personal link) to every guest
// in this event who hasn't been sent one yet. Guests added later (or a
// second click) only message the new/un-sent ones — safe to click again.
export async function POST(request, { params }) {
  const { id: eventId } = await params;
  if (!(await canAccessEvent(eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const templateName = process.env.WATI_INVITE_TEMPLATE_NAME;

  // Refuse to send rather than fall back to some default template name. This
  // used to default to Meta's "hello_world" sample, which meant a missing env
  // var didn't fail — it quietly sent every guest a placeholder message from
  // WhatsApp's own docs. Bad sends can't be recalled, so a blocked send with
  // a clear reason is always the better outcome. isUsableTemplateName also
  // rejects "hello_world" when it's the value actually set, not just missing.
  if (watiIsConfigured() && !isUsableTemplateName(templateName)) {
    return NextResponse.json(
      {
        error:
          "قالب الدعوة على واتساب غير مضبوط — اضبط WATI_INVITE_TEMPLATE_NAME باسم قالب معتمد من Meta (مثل da3wa_invite_link بعد اعتماده، أو main_msg للاختبار الآن) قبل الإرسال",
      },
      { status: 503 }
    );
  }

  // The personal link IS the message — a guest who can't open it has received
  // nothing. If NEXT_PUBLIC_BASE_URL is unset or still points at a dev
  // machine, every link in the batch is dead on arrival, and a sent WhatsApp
  // message can't be recalled. Cheaper to fail here than to explain later.
  const baseLooksUnusable = !base || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(base);
  if (watiIsConfigured() && baseLooksUnusable) {
    return NextResponse.json(
      {
        error: `رابط الموقع غير مضبوط بشكل صحيح (${base || "فارغ"}) — اضبط NEXT_PUBLIC_BASE_URL على https://www.da3wa.digital قبل الإرسال، وإلا وصلت الضيوف روابط لا تعمل`,
      },
      { status: 503 }
    );
  }

  // Ask Wati whether this template is actually usable before messaging
  // anyone. Without this, a name that is missing or still awaiting Meta
  // review fails once per guest with an opaque 400, and the batch marks every
  // one of them as "invited" on the way past.
  const templateProblem = await describeTemplateProblem(templateName);
  if (templateProblem) {
    return NextResponse.json({ error: templateProblem }, { status: 503 });
  }

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });

  const coupleParts = resolveCoupleParts(event);

  // da3wa_invite_link renders "{{groom}} و {{bride}}" in its body, so sending
  // it a blank half would reach guests as a dangling "و". Legacy events whose
  // joined name couldn't be split automatically land here until the admin
  // fills the two fields in.
  const needsSplitNames = templateName !== "main_msg";
  if (watiIsConfigured() && needsSplitNames && (!coupleParts.groomName || !coupleParts.brideName)) {
    return NextResponse.json(
      {
        error:
          "اسم العريس واسم العروسة غير مفصولين لهذا الزفاف — افتح \"تعديل تفاصيل الزفاف\" واملأ الخانتين قبل الإرسال",
      },
      { status: 409 }
    );
  }

  const pendingGuests = db.guests.filter((g) => g.eventId === eventId && !g.invitedAt);

  if (pendingGuests.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: "تم إرسال الدعوة لجميع الضيوف مسبقًا" });
  }

  let sent = 0;
  let failed = 0;

  // Sequential on purpose — respects Wati's per-account send-rate limits
  // and keeps a clean, ordered log in the feed.
  for (const guest of pendingGuests) {
    const link = `${base}/invite/${guest.id}?t=${makeInviteToken(guest.id)}`;
    const waResult = await sendTemplateMessage({
      phone: guest.phoneDisplay || guest.phone,
      // Only ever undefined when Wati isn't configured at all (the guard
      // above), in which case the send is simulated and the name is just a
      // label in the admin feed.
      templateName: templateName || "da3wa_invite",
      broadcastName: "da3wa_invite_link",
      // A superset of what any configured template might ask for, since which
      // one is active is an environment variable. sendTemplateMessage trims
      // this to exactly the parameters the template declares, in its own
      // order — main_msg takes two of these, da3wa_invite_link takes four.
      params: [
        { name: "name", value: guest.name },
        { name: "groom", value: coupleParts.groomName },
        { name: "bride", value: coupleParts.brideName },
        { name: "couple", value: coupleParts.coupleNames },
        { name: "link", value: link },
      ],
    });

    const status = waResult.simulated ? "simulated" : waResult.error ? "failed" : "sent";
    if (status === "sent" || status === "simulated") sent++;
    else failed++;

    await withDb((freshDb) => {
      const g = freshDb.guests.find((x) => x.id === guest.id);
      // Only a guest who actually received something counts as invited. This
      // used to be stamped unconditionally, so a failed send still marked
      // them invited — and since this endpoint deliberately skips anyone with
      // invitedAt set, clicking Send again silently did nothing. A failure has
      // to leave the guest retryable, or the fix for the failure is useless.
      if (g && status !== "failed") g.invitedAt = new Date().toISOString();
      freshDb.messages.push({
        id: randomUUID(),
        eventId,
        guestId: guest.id,
        guestName: guest.name,
        phone: guest.phoneDisplay || guest.phone,
        type: "invite_sent",
        status,
        waMessageId: waResult.messageId || null,
        content:
          status === "failed"
            ? `تعذّر إرسال رابط الدعوة إلى ${guest.name}`
            : `تم إرسال رابط الدعوة إلى ${guest.name}`,
        error: waResult.error || null,
        createdAt: new Date().toISOString(),
      });
    });
  }

  return NextResponse.json({ sent, failed, total: pendingGuests.length });
}
