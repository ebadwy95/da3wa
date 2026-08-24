import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";

// Wati's delivery callbacks.
//
// Wati's API returning success only means it accepted the message for sending.
// WhatsApp can still refuse it after that — an unapproved display name, a
// recipient outside the allowed list on a new account, a template revoked by
// Meta — and none of that comes back on the original request. Without this
// endpoint the dashboard says "تم الإرسال فعليًا" for a message that never
// arrived, and the only way to find out is to open Wati and read the chat.
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

// Delivery progresses sent -> delivered -> read, and those events can land out
// of order, so a late DELIVERED must not walk back a READ.
//
// Failure is not a step on that ladder — it's a verdict, and it is the whole
// reason this endpoint exists. It always wins, and nothing overwrites it
// afterwards. (Ranking it below "sent" quietly discarded every rejection,
// which is exactly the case this was built to surface.)
const PROGRESS = { sent: 1, delivered: 2, read: 3 };

function nextStatus(current, incoming) {
  if (incoming === "failed") return "failed";
  if (current === "failed") return "failed";
  if (!incoming) return current;
  return PROGRESS[incoming] > (PROGRESS[current] ?? 0) ? incoming : current;
}

function digitsOnly(value) {
  return String(value || "").replace(/[^\d]/g, "");
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
  const messageId = body.localMessageId || body.local_message_id || body.id || null;
  const phone = digitsOnly(body.waId || body.whatsappNumber || body.phone);
  // Wati has no failure event, so the refusal arrives inside a send event's
  // payload. The field name varies, and Meta's own errors nest one level down.
  const failureReason =
    body.failureReason ||
    body.errorMessage ||
    body.error?.message ||
    (typeof body.error === "string" ? body.error : null) ||
    body.errors?.[0]?.message ||
    null;
  const status = classify(eventType, failureReason);

  const outcome = await withDb((db) => {
    db.messages = db.messages || [];

    // Prefer Wati's own id. Fall back to the most recent message we sent to
    // that number, which is accurate at this app's volume — a wedding sends
    // one invite per guest, not a stream.
    let target = messageId ? db.messages.find((m) => m.waMessageId === messageId) : null;
    if (!target && phone) {
      target = db.messages
        .filter((m) => digitsOnly(m.phone) === phone)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }

    if (!target) return { matched: false, eventType };

    // Record the raw event even when it isn't one we classify, so an
    // unfamiliar Wati event is visible rather than silently discarded.
    target.deliveryEvent = eventType || null;
    target.deliveryAt = new Date().toISOString();

    const resolved = nextStatus(target.status, status);
    if (resolved !== target.status || resolved === "failed") {
      target.status = resolved;
      if (resolved === "failed") {
        // Keep whatever reason we already had if this event carries none —
        // the first report of a failure usually has the detail.
        target.error =
          failureReason ||
          target.error ||
          `رفضت واتساب الرسالة (${eventType || "بدون تفاصيل"})`;
      } else {
        target.error = null;
      }
    }

    return { matched: true, guestName: target.guestName, status: target.status };
  });

  // Always 200: a webhook that errors gets retried, and a payload we simply
  // don't recognise is not something a retry will fix.
  return NextResponse.json({ ok: true, ...outcome });
}
