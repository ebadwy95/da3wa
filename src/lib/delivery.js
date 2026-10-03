import { getDb, withDb } from "@/lib/db";
import { messagingProvider } from "@/lib/messaging";
import { getRecentMessages } from "@/lib/wati";

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

// ---------------------------------------------------------------------------
// Asking for the verdict instead of waiting for it.
//
// Wati's Growth plan sends no delivery webhooks, so without this a message
// stays at "sent" forever — including every one WhatsApp refused. That is
// exactly how a whole round of test sends looked fine in the dashboard while
// none of them arrived (error 131037, display name under review). So when a
// wedding's feed is opened, any message still waiting on a verdict is looked
// up in Wati, and its real status and failure reason are written back.

// The dashboard polls the feed every few seconds; Wati does not need to be
// asked that often, and a sync that is already running should not start twice.
const SYNC_EVERY_MS = 45 * 1000;
const lastSyncByEvent = new Map();

// How long a message keeps being checked. A verdict that has not arrived after
// a week is not going to.
const SYNC_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Our log entry is written right after Wati accepts the send, so Wati's own
// record of it sits a few seconds either side.
const MATCH_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * Brings the statuses of one wedding's recent messages up to date from Wati.
 * Safe to call on every feed read: it throttles itself, and does nothing
 * unless Wati is the active provider.
 */
export async function syncEventDeliveries(eventId) {
  if (messagingProvider() !== "wati") return { skipped: "provider" };
  const now = Date.now();
  if (now - (lastSyncByEvent.get(eventId) || 0) < SYNC_EVERY_MS) return { skipped: "recent" };
  lastSyncByEvent.set(eventId, now);

  const db = await getDb();
  const pending = (db.messages || []).filter(
    (m) =>
      m.eventId === eventId &&
      (m.status === "sent" || m.status === "delivered") &&
      m.phone &&
      now - new Date(m.createdAt).getTime() < SYNC_WINDOW_MS
  );
  if (pending.length === 0) return { checked: 0 };

  const byPhone = new Map();
  for (const m of pending) {
    const key = digitsOnly(m.phone);
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key).push(m);
  }

  const updates = [];
  for (const [phone, ours] of byPhone) {
    let theirs;
    try {
      theirs = await getRecentMessages(phone);
    } catch (err) {
      console.warn("[delivery] could not read Wati statuses:", err.message);
      continue;
    }
    // Each Wati record is used once, closest in time first, so two messages
    // sent to the same number a second apart are not both matched to one.
    const unused = theirs.filter((t) => t.status && t.created);
    for (const m of ours) {
      const at = new Date(m.createdAt).getTime();
      let best = null;
      for (const t of unused) {
        const gap = Math.abs(new Date(t.created).getTime() - at);
        if (gap <= MATCH_TOLERANCE_MS && (!best || gap < best.gap)) best = { t, gap };
      }
      if (!best) continue;
      unused.splice(unused.indexOf(best.t), 1);
      const resolved = nextStatus(m.status, best.t.status);
      if (resolved !== m.status) {
        updates.push({
          id: m.id,
          status: resolved,
          error: resolved === "failed" ? best.t.failedDetail || "رفضت واتساب الرسالة" : null,
        });
      }
    }
  }

  if (updates.length) {
    await withDb((fresh) => {
      for (const u of updates) {
        const target = (fresh.messages || []).find((x) => x.id === u.id);
        if (!target) continue;
        target.status = nextStatus(target.status, u.status);
        if (target.status === "failed") target.error = u.error;
        target.deliveryAt = new Date().toISOString();
      }
    });
  }
  return { checked: pending.length, updated: updates.length };
}
