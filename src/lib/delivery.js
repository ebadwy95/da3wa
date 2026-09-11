import { withDb } from "@/lib/db";

// Recording what happened to a message after it was sent.
//
// A provider accepting a message only means it was queued. WhatsApp can still
// refuse it afterwards — an unapproved display name, a recipient the account
// isn't allowed to reach yet, a template Meta revoked — and that verdict
// arrives later, over a webhook. Both webhooks (Wati's and Meta's own) end up
// here, so the rules for turning those reports into a status live in one place.

// Delivery progresses sent -> delivered -> read, and reports can land out of
// order, so a late "delivered" must not walk back a "read".
//
// Failure is not a step on that ladder — it's a verdict, and surfacing it is
// the reason the webhooks exist. It always wins, and nothing overwrites it
// afterwards. (Ranking it below "sent" once quietly discarded every rejection.)
const PROGRESS = { sent: 1, delivered: 2, read: 3 };

export function nextStatus(current, incoming) {
  if (incoming === "failed") return "failed";
  if (current === "failed") return "failed";
  if (!incoming) return current;
  return PROGRESS[incoming] > (PROGRESS[current] ?? 0) ? incoming : current;
}

function digitsOnly(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

/**
 * Applies one delivery report to the message log.
 * @param {string|null} messageId  the provider's id for the message (wamid for Meta)
 * @param {string|null} phone      recipient, used only when the id doesn't match
 * @param {"sent"|"delivered"|"read"|"failed"|null} status
 * @param {string|null} eventLabel the provider's own name for the event, kept verbatim
 * @param {string|null} failureReason
 */
export async function recordDeliveryUpdate({ messageId, phone, status, eventLabel, failureReason }) {
  const number = digitsOnly(phone);

  return withDb((db) => {
    db.messages = db.messages || [];

    // Prefer the provider's id. Fall back to the most recent message sent to
    // that number, which is accurate at this app's volume — a wedding sends one
    // invite per guest, not a stream.
    let target = messageId ? db.messages.find((m) => m.waMessageId === messageId) : null;
    if (!target && number) {
      target = db.messages
        .filter((m) => digitsOnly(m.phone) === number)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }
    if (!target) return { matched: false, eventLabel };

    // Kept even when it isn't a status we classify, so an unfamiliar event is
    // visible in the record rather than silently dropped.
    target.deliveryEvent = eventLabel || null;
    target.deliveryAt = new Date().toISOString();

    const resolved = nextStatus(target.status, status);
    if (resolved !== target.status || resolved === "failed") {
      target.status = resolved;
      if (resolved === "failed") {
        // The first report of a failure usually carries the detail; a later
        // one without it shouldn't erase it.
        target.error =
          failureReason || target.error || `رفضت واتساب الرسالة (${eventLabel || "بدون تفاصيل"})`;
      } else {
        target.error = null;
      }
    }

    return { matched: true, guestName: target.guestName, status: target.status };
  });
}
