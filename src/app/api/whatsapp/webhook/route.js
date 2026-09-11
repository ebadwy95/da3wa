import { NextResponse } from "next/server";
import { recordDeliveryUpdate } from "@/lib/delivery";

// Wati's delivery callbacks.
//
// Wati's API returning success only means it accepted the message for sending.
// WhatsApp can still refuse it after that — an unapproved display name, a
// recipient outside the allowed list on a new account, a template revoked by
// Meta — and none of that comes back on the original request. Without this
// endpoint the dashboard says "تم الإرسال فعليًا" for a message that never
// arrived, and the only way to find out is to open Wati and read the chat.
//
// Meta's own webhook, for the Cloud API, is /api/whatsapp/cloud-webhook. Both
// hand their reports to src/lib/delivery.js, which owns the status rules.
//
// Point Wati's webhook at:  <site>/api/whatsapp/webhook?secret=<WATI_WEBHOOK_SECRET>
export const dynamic = "force-dynamic";

// Wati names events by what happened rather than with a status field, and the
// account's list is entirely positive — Message Received, Template Message
// Sent, Sent Message is DELIVERED / READ / REPLIED, plus v2 variants. There is
// no FAILED event to subscribe to.
//
// So a refusal does not arrive as its own event: it rides along on a send
// event carrying an error payload, the way #131037 (display name not
// approved) did. The error field is therefore checked FIRST, and it overrides
// whatever the event name claims — otherwise a rejected message would be
// classified "sent" by its name and its reason thrown away, which is the exact
// failure this endpoint exists to catch.
function classify(eventType, failureReason) {
  if (failureReason) return "failed";
  const e = String(eventType || "").toLowerCase();
  if (/fail|error|undeliver|reject/.test(e)) return "failed";
  if (/read/.test(e)) return "read";
  if (/deliver/.test(e)) return "delivered";
  if (/sent|replied/.test(e)) return "sent";
  return null;
}

export async function POST(request) {
  const secret = process.env.WATI_WEBHOOK_SECRET;
  const provided = new URL(request.url).searchParams.get("secret");
  // Unset secret means the webhook isn't configured yet — refuse rather than
  // accept unauthenticated writes into the message log.
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "payload غير صالح" }, { status: 400 });

  const eventType = body.eventType || body.type || body.event;
  // Wati has no failure event, so the refusal arrives inside a send event's
  // payload. The field name varies, and Meta's own errors nest one level down.
  const failureReason =
    body.failureReason ||
    body.errorMessage ||
    body.error?.message ||
    (typeof body.error === "string" ? body.error : null) ||
    body.errors?.[0]?.message ||
    null;

  const outcome = await recordDeliveryUpdate({
    messageId: body.localMessageId || body.local_message_id || body.id || null,
    phone: body.waId || body.whatsappNumber || body.phone || null,
    status: classify(eventType, failureReason),
    eventLabel: eventType || null,
    failureReason,
  });

  // Always 200: a webhook that errors gets retried, and a payload we simply
  // don't recognise is not something a retry will fix.
  return NextResponse.json({ ok: true, ...outcome });
}
