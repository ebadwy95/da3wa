// Client for Meta's WhatsApp Cloud API — sending straight to Meta, with no
// Business Solution Provider in between.
//
// This replaces Wati as the delivery route. Wati's trial ended and its API
// started answering every call with an HTML login page, which the app could
// only report as "Unexpected token '<'". A subscription that lapses takes the
// whole invitation flow down with it, and nothing Wati sold was being used
// here — no shared inbox, no chatbot, no campaigns. The app sends one template
// per guest, which is exactly what the Cloud API does, billed by Meta per
// message and with nothing in the middle that can expire.
//
// The exported functions deliberately match src/lib/wati.js name for name and
// return the same shapes ({ simulated, error, messageId, … }), so the routes
// that send messages do not need to know which provider is behind them. See
// src/lib/messaging.js, which picks one.
//
// Environment:
//   WHATSAPP_CLOUD_TOKEN        System User access token (permanent)
//   WHATSAPP_PHONE_NUMBER_ID    the sending number's id — not the number itself
//   WHATSAPP_WABA_ID            WhatsApp Business Account id, for reading templates
//   WHATSAPP_GRAPH_VERSION      optional, defaults below
//   WHATSAPP_TEMPLATE_LANGUAGE  optional, defaults to "ar"

// v25.0 is supported until July 2028. Pinned rather than "latest" because Meta
// changes payloads between versions, and a silent version bump is not a thing
// anyone would think to look for when invitations stop arriving.
const DEFAULT_GRAPH_VERSION = "v25.0";

function config() {
  return {
    token: process.env.WHATSAPP_CLOUD_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    wabaId: process.env.WHATSAPP_WABA_ID || "",
    version: process.env.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION,
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ar",
  };
}

export function cloudIsConfigured() {
  const { token, phoneNumberId } = config();
  return Boolean(token && phoneNumberId);
}

function digitsOnly(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

async function graph(path, { method = "GET", body } = {}) {
  const { token, version } = config();
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok || json.error) {
    // Meta's error carries a numeric code and, usually, a sentence in
    // error_data.details that says what actually went wrong. Both go into the
    // message: "#131026 — Receiver is incapable of receiving this message" is
    // something the admin feed can act on, a bare 400 is not.
    const e = json.error || {};
    const detail = e.error_data?.details;
    throw new Error(
      `WhatsApp Cloud API ${res.status}${e.code ? ` (#${e.code})` : ""}: ` +
        `${e.message || String(text).slice(0, 300)}${detail ? ` — ${detail}` : ""}`
    );
  }
  return json;
}

// Templates, read from the WhatsApp Business Account.
//
// A template's body declares its variables inline — {{name}} for a template
// created with named parameters, {{1}} for a positional one. The routes pass a
// superset of values (everything any configured template might ask for), and
// the declared names decide which of them are sent. Same approach as the Wati
// client, which read the same thing out of customParams.
//
// Cached for ten minutes: a bulk send loops over every guest, and templates
// change about as often as someone edits one in WhatsApp Manager.
const TEMPLATE_CACHE_MS = 10 * 60 * 1000;
let templateCache = { at: 0, byName: null };

function readTemplate(t) {
  const body = (t.components || []).find((c) => String(c.type).toUpperCase() === "BODY");
  const names = [
    ...new Set([...String(body?.text || "").matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1])),
  ];
  return {
    status: String(t.status || "").toUpperCase(),
    language: t.language || "",
    paramNames: names,
    positional:
      String(t.parameter_format || "").toUpperCase() === "POSITIONAL" ||
      (names.length > 0 && names.every((n) => /^\d+$/.test(n))),
  };
}

async function loadTemplates() {
  const now = Date.now();
  if (templateCache.byName && now - templateCache.at < TEMPLATE_CACHE_MS) {
    return templateCache.byName;
  }

  const { wabaId, language, version } = config();
  if (!wabaId) throw new Error("WHATSAPP_WABA_ID غير مضبوط");

  const byName = new Map();
  let path = `${wabaId}/message_templates?fields=name,status,language,parameter_format,components&limit=100`;
  while (path) {
    const json = await graph(path);
    for (const t of json.data || []) {
      if (!t.name) continue;
      // One name can exist in several languages. The configured language wins;
      // otherwise the first one seen is kept, so a template that only exists in
      // English is still found and reported rather than called missing.
      if (!byName.has(t.name) || t.language === language) {
        byName.set(t.name, readTemplate(t));
      }
    }
    const next = json.paging?.next;
    path = next ? next.replace(new RegExp(`^https://graph\\.facebook\\.com/${version}/`), "") : null;
  }

  templateCache = { at: now, byName };
  return byName;
}

/** The account's templates as a Map of name -> { status, paramNames, language }. Throws if Meta can't be reached. */
export async function listAccountTemplates() {
  return loadTemplates();
}

/**
 * Checked once before a bulk send, so a missing or unapproved template fails
 * with one clear sentence instead of once per guest. Returns null when the
 * template is usable — or when the account can't be read at all, because a
 * failed metadata lookup should never block a send that would have worked.
 */
export async function describeTemplateProblem(templateName) {
  if (!cloudIsConfigured()) return null;
  let byName;
  try {
    byName = await loadTemplates();
  } catch {
    return null;
  }

  const approved = [...byName.entries()].filter(([, t]) => t.status === "APPROVED").map(([n]) => n);
  const approvedList = approved.length ? approved.join("، ") : "لا يوجد أي قالب معتمد بعد";

  const found = byName.get(templateName);
  if (!found) {
    return `القالب "${templateName}" غير موجود في حساب واتساب. القوالب المعتمدة حاليًا: ${approvedList}`;
  }
  if (found.status !== "APPROVED") {
    return `القالب "${templateName}" حالته ${found.status} — واتساب لا يرسل إلا القوالب المعتمدة. المعتمدة حاليًا: ${approvedList}`;
  }
  if (found.positional && found.paramNames.length > 0) {
    return `القالب "${templateName}" متغيراته بالأرقام ({{1}}). أنشئه بمتغيرات بالأسماء ({{name}}، {{link}}…) حتى يعرف النظام أي قيمة تذهب لأي مكان`;
  }
  return null;
}

/**
 * Sends an approved template.
 * @param {string} phone        any format; reduced to digits
 * @param {string} templateName an APPROVED template on the account
 * @param {string} broadcastName unused by Meta — kept so callers match the Wati client
 * @param {{name: string, value: string}[]} params superset of values, matched by name
 */
export async function sendTemplateMessage({ phone, templateName, params = [] }) {
  const to = digitsOnly(phone);
  if (!cloudIsConfigured()) {
    return {
      simulated: true,
      reason: "WHATSAPP_CLOUD_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured",
      phone: to,
      templateName,
      params,
    };
  }

  try {
    let found = null;
    try {
      found = (await loadTemplates()).get(templateName) || null;
    } catch (err) {
      console.warn("[whatsapp-cloud] could not read templates, sending without parameter matching:", err.message);
    }

    const template = { name: templateName, language: { code: found?.language || config().language } };

    if (found?.paramNames.length) {
      if (found.positional) {
        // Guessing which value belongs in {{1}} would put a guest's link where
        // their name should be, and a sent message cannot be recalled.
        return {
          simulated: false,
          error: `القالب "${templateName}" متغيراته بالأرقام — لازم يكون بمتغيرات بالأسماء`,
        };
      }
      const supplied = new Map(params.map((p) => [p.name, p.value]));
      const missing = found.paramNames.filter((n) => !String(supplied.get(n) ?? "").trim());
      if (missing.length) {
        // Meta rejects an empty parameter anyway; saying which one is empty is
        // the useful part.
        return { simulated: false, error: `قيم ناقصة للقالب "${templateName}": ${missing.join("، ")}` };
      }
      template.components = [
        {
          type: "body",
          parameters: found.paramNames.map((n) => ({
            type: "text",
            parameter_name: n,
            text: String(supplied.get(n)),
          })),
        },
      ];
    }

    const result = await graph(`${config().phoneNumberId}/messages`, {
      method: "POST",
      body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template },
    });

    // Accepted is not delivered. Meta queues the message and reports the real
    // outcome later over the webhook; the wamid is what ties that report back
    // to this send.
    return { simulated: false, result, messageId: result?.messages?.[0]?.id || null, phone: to };
  } catch (err) {
    return { simulated: false, error: err.message };
  }
}

/**
 * Free-form text. Meta only delivers it inside the 24-hour window that opens
 * when the recipient messages the business, so it's for replies and tests —
 * never for first contact with a guest.
 */
export async function sendSessionMessage({ phone, text }) {
  const to = digitsOnly(phone);
  if (!cloudIsConfigured()) {
    return {
      simulated: true,
      reason: "WHATSAPP_CLOUD_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured",
      phone: to,
      text,
    };
  }
  try {
    const result = await graph(`${config().phoneNumberId}/messages`, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body: text },
      },
    });
    return { simulated: false, result, messageId: result?.messages?.[0]?.id || null, phone: to };
  } catch (err) {
    return { simulated: false, error: err.message };
  }
}
