// The wedding's security team: who gets called to the gate, and how.
//
// A door alert cannot travel over WhatsApp. A template message can sit in a
// queue, be refused by Meta, or land silently among a hundred wedding
// messages — and when the person at the gate needs help, any of those is
// the same as no alert at all. So an alert is a Web Push notification, sent
// straight to the phones of the people on the security team: it rings and
// vibrates like a call notification, stays on the lock screen until it is
// answered, and needs no third party besides the phone's own push service.
//
// Each security contact gets a personal link (/guard/<key>). Opening it and
// pressing "activate" subscribes that phone; the subscription is stored here
// against the contact, so every alert reaches every phone they activated.

import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { makeGuardKey, parseGuardKey } from "@/lib/token";
import { siteOrigin } from "@/lib/seo";

export const MAX_SECURITY_CONTACTS = 3;

// Kept per wedding, newest first. A wedding night produces a handful of
// alerts; this only stops a runaway loop from filling the database.
const PER_EVENT_ALERT_LIMIT = 100;

// A guest holding up an already-used code in front of the camera produces
// a fresh decode every few seconds. One alert per guest per minute calls the
// team once; the scanner keeps sounding its own alarm for every attempt.
const DUPLICATE_ALERT_WINDOW_MS = 60 * 1000;

// How long an alert stays "live" on the guard and scanner screens.
export const LIVE_ALERT_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Cleans the contact list an admin submitted. Names and phones are trimmed,
 * an empty row is dropped, and an existing contact keeps its id — the id is
 * part of their personal link, so editing a phone number must not break the
 * link they already installed.
 */
export function sanitizeContacts(input, existing = []) {
  if (!Array.isArray(input)) return { error: "قائمة غير صالحة" };
  const known = new Set(existing.map((c) => c.id));
  const contacts = [];
  for (const raw of input) {
    const name = String(raw?.name || "").trim().slice(0, 60);
    const phoneRaw = String(raw?.phone || "").trim();
    if (!name && !phoneRaw) continue;
    if (!name) return { error: "اكتب اسم كل شخص في فريق الأمن" };
    const phone = normalizePhone(phoneRaw);
    if (!phone.valid) return { error: `رقم ${name}: ${phone.error}` };
    contacts.push({
      id: known.has(raw?.id) ? raw.id : randomUUID(),
      name,
      phone: phone.e164,
    });
  }
  if (contacts.length > MAX_SECURITY_CONTACTS) {
    return { error: `الحد الأقصى ${MAX_SECURITY_CONTACTS} أشخاص` };
  }
  return { contacts };
}

export function guardLink(eventId, contactId) {
  return `${siteOrigin()}/guard/${makeGuardKey(eventId, contactId)}`;
}

export function pushIsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let webPushPromise = null;
function getWebPush() {
  if (!webPushPromise) {
    webPushPromise = import("web-push").then((mod) => {
      const webpush = mod.default || mod;
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:hello@da3wa.digital",
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      return webpush;
    });
  }
  return webPushPromise;
}

function notificationFor(alert, event) {
  const couple = event?.coupleNames || "";
  if (alert.type === "sos") {
    return {
      title: "🚨 طوارئ عند البوابة",
      body: `${alert.staffName || "موظف الباب"} ضغط زر الطوارئ${couple ? ` — ${couple}` : ""}. اطلع البوابة فورًا.`,
    };
  }
  if (alert.type === "duplicate") {
    return {
      title: "⚠️ باركود مستخدم عند البوابة",
      body: `${alert.guestName ? `بطاقة ${alert.guestName}` : "بطاقة دخول"} اتمسحت قبل كده واتقدّمت تاني. ${alert.staffName || "الباب"} محتاجك فورًا.`,
    };
  }
  return {
    title: "✅ تجربة تنبيه",
    body: "التنبيهات شغالة على الجهاز ده — كده هيوصلك أي نداء من البوابة.",
  };
}

/**
 * Sends one alert to the given subscriptions. Each payload carries the
 * recipient's own guard key, so the notification's "on my way" button can
 * answer for that person without the page being open. Subscriptions the push
 * service reports as gone (the app was uninstalled, permission revoked) are
 * returned so the caller can forget them.
 */
async function deliver(alert, event, subscriptions) {
  if (!pushIsConfigured() || subscriptions.length === 0) {
    return { delivered: [], dead: [] };
  }
  const webpush = await getWebPush();
  const { title, body } = notificationFor(alert, event);
  const delivered = [];
  const dead = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const key = makeGuardKey(sub.eventId, sub.contactId);
      const payload = JSON.stringify({
        title,
        body,
        alertId: alert.id,
        type: alert.type,
        url: `/guard/${key}`,
        ack: alert.type === "test" ? null : { url: "/api/security/ack", body: { key, alertId: alert.id } },
      });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          // "high" wakes a phone that is dozing; five minutes is long enough
          // to reach a phone that just lost signal, and short enough that a
          // phone switched on tomorrow does not ring about tonight.
          { TTL: 300, urgency: "high" }
        );
        delivered.push(sub.contactId);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(sub.endpoint);
        else console.warn("[security] push failed:", err?.statusCode, err?.body || err?.message);
      }
    })
  );
  return { delivered, dead };
}

/**
 * Records an alert and calls the security team. Returns
 * { alert, notified: [names], throttled }.
 *
 * type: "sos" (the scanner's emergency button), "duplicate" (an already-used
 * entry code was presented — raised by the check-in route itself, so it does
 * not depend on the scanner page behaving), or "test".
 * onlyContactId limits a test to one person's phones.
 */
export async function raiseSecurityAlert({
  eventId,
  type,
  staffName = null,
  guestId = null,
  guestName = null,
  onlyContactId = null,
}) {
  const now = new Date();

  const recorded = await withDb((db) => {
    db.securityAlerts = db.securityAlerts || [];
    if (type === "duplicate" && guestId) {
      const recent = db.securityAlerts.find(
        (a) =>
          a.eventId === eventId &&
          a.type === "duplicate" &&
          a.guestId === guestId &&
          now - new Date(a.createdAt) < DUPLICATE_ALERT_WINDOW_MS
      );
      if (recent) return { alert: recent, throttled: true };
    }
    const alert = {
      id: randomUUID(),
      eventId,
      type,
      staffName,
      guestId,
      guestName,
      createdAt: now.toISOString(),
      notified: [],
      acks: [],
    };
    db.securityAlerts.unshift(alert);
    let kept = 0;
    db.securityAlerts = db.securityAlerts.filter(
      (a) => a.eventId !== eventId || ++kept <= PER_EVENT_ALERT_LIMIT
    );
    return { alert, throttled: false };
  });

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  const contacts = event?.securityContacts || [];
  const names = new Map(contacts.map((c) => [c.id, c.name]));

  if (recorded.throttled) {
    return {
      alert: recorded.alert,
      throttled: true,
      notified: recorded.alert.notified.map((id) => names.get(id)).filter(Boolean),
    };
  }

  const subscriptions = (db.pushSubscriptions || []).filter(
    (s) =>
      s.eventId === eventId &&
      names.has(s.contactId) &&
      (!onlyContactId || s.contactId === onlyContactId)
  );
  const { delivered, dead } = await deliver(recorded.alert, event, subscriptions);
  const notifiedIds = [...new Set(delivered)];

  if (notifiedIds.length || dead.length) {
    await withDb((fresh) => {
      const a = (fresh.securityAlerts || []).find((x) => x.id === recorded.alert.id);
      if (a) a.notified = notifiedIds;
      if (dead.length) {
        fresh.pushSubscriptions = (fresh.pushSubscriptions || []).filter(
          (s) => !dead.includes(s.endpoint)
        );
      }
    });
  }

  return {
    alert: { ...recorded.alert, notified: notifiedIds },
    throttled: false,
    notified: notifiedIds.map((id) => names.get(id)).filter(Boolean),
  };
}

/** An alert as the screens show it: who was called, and who answered. */
export function presentAlert(alert, contacts, viewerContactId = null) {
  const names = new Map((contacts || []).map((c) => [c.id, c.name]));
  return {
    id: alert.id,
    type: alert.type,
    staffName: alert.staffName,
    guestName: alert.guestName,
    createdAt: alert.createdAt,
    notified: (alert.notified || []).map((id) => names.get(id)).filter(Boolean),
    acks: (alert.acks || []).map((a) => ({
      name: names.get(a.contactId) || "",
      at: a.at,
    })),
    ...(viewerContactId
      ? { ackedByMe: (alert.acks || []).some((a) => a.contactId === viewerContactId) }
      : {}),
  };
}

export function liveAlertsFor(db, eventId, { includeTests = false, viewerContactId = null } = {}) {
  const event = db.events.find((e) => e.id === eventId);
  const since = Date.now() - LIVE_ALERT_WINDOW_MS;
  return (db.securityAlerts || [])
    .filter(
      (a) =>
        a.eventId === eventId &&
        (includeTests || a.type !== "test") &&
        new Date(a.createdAt).getTime() >= since
    )
    .slice(0, 20)
    .map((a) => presentAlert(a, event?.securityContacts, viewerContactId));
}

/**
 * Resolves a guard link's key to its wedding and contact. Null when the
 * signature is wrong, or when the person has since been removed from the
 * wedding's security team — a valid signature alone is not enough.
 */
export function resolveGuard(db, key) {
  const parsed = parseGuardKey(key);
  if (!parsed) return null;
  const event = db.events.find((e) => e.id === parsed.eventId && e.status !== "deleted");
  const contact = (event?.securityContacts || []).find((c) => c.id === parsed.contactId);
  if (!event || !contact) return null;
  return { event, contact };
}
