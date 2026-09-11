import { NextResponse } from "next/server";
import crypto from "crypto";
import { recordDeliveryUpdate } from "@/lib/delivery";

// Meta's own webhook for the WhatsApp Cloud API.
//
// Sending returns a message id and nothing else — whether the invitation was
// actually delivered, read, or refused arrives here afterwards. This is what
// lets the dashboard say "عماد فتح الرسالة" instead of only "sent", and what
// catches a refusal (an unapproved template, a number that can't receive) that
// would otherwise look like a successful send.
//
// In the Meta app: WhatsApp → Configuration → Webhook
//   Callback URL:  <site>/api/whatsapp/cloud-webhook
//   Verify token:  the value of WHATSAPP_WEBHOOK_VERIFY_TOKEN
//   Subscribe to:  messages
export const dynamic = "force-dynamic";

// Meta calls this once, when the webhook is saved, and expects the challenge
// echoed back as plain text. Anything else and the dashboard refuses to save.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
}

// Meta signs every delivery with the app secret. Without checking it, anyone
// who learns this URL could mark messages as read or failed in the log. An
// unset secret refuses everything rather than accepting unsigned writes.
function signatureIsValid(rawBody, header) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

// Meta's status names map straight onto the ladder in src/lib/delivery.js.
// "played" is a voice note being listened to; it never applies to a template,
// so it is recorded as an event but changes nothing.
const STATUS = { sent: "sent", delivered: "delivered", read: "read", failed: "failed" };

function failureReasonOf(s) {
  const e = s.errors?.[0];
  if (!e) return null;
  const detail = e.error_data?.details;
  return `#${e.code}: ${e.message || e.title}${detail && detail !== e.message ? ` — ${detail}` : ""}`;
}

export async function POST(request) {
  // The signature covers the raw bytes, so the body is read as text first and
  // parsed afterwards — parsing and re-serialising would change it.
  const raw = await request.text();
  if (!signatureIsValid(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "payload غير صالح" }, { status: 400 });
  }

  const results = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      for (const s of change.value?.statuses || []) {
        results.push(
          await recordDeliveryUpdate({
            messageId: s.id || null,
            phone: s.recipient_id || null,
            status: STATUS[s.status] || null,
            eventLabel: s.status || null,
            failureReason: s.status === "failed" ? failureReasonOf(s) : null,
          })
        );
      }
      // Incoming messages (a guest replying to their invitation) arrive on the
      // same field under value.messages. Nothing reads them yet; they are
      // acknowledged so Meta doesn't retry them.
    }
  }

  // Always 200 for a signed payload: a webhook that errors is retried, and a
  // report we don't recognise is not something a retry will fix.
  return NextResponse.json({ ok: true, updates: results.length });
}
