// Thin client around Wati's REST API (https://live-mt-server.wati.io/<tenant>).
//
// Two send paths, mirroring Wati/WhatsApp's own rules:
//  - sendSessionMessage: free-form text, but ONLY allowed within 24h of the
//    guest having messaged the business (a "session"). Fine for replies.
//  - sendTemplateMessage: works any time, but the message must use a
//    pre-approved Meta template. This is what we use for the first-contact
//    "your invitation" / QR-delivery / reminder messages.
//
// If WATI_ACCESS_TOKEN / WATI_API_ENDPOINT aren't configured, calls resolve
// to a "simulated" result instead of throwing — so the rest of the app (and
// local dev without WhatsApp set up) keeps working, and the admin feed can
// clearly show which messages were really sent vs. simulated.

function isConfigured() {
  return Boolean(process.env.WATI_API_ENDPOINT && process.env.WATI_ACCESS_TOKEN);
}

// Every new WhatsApp Business account ships with Meta's sample template
// "hello_world", and it's the value that gets pasted in while wiring things
// up — the production environment was found holding exactly that for
// WATI_QR_TEMPLATE_NAME. It is never a legitimate template for this app: it
// isn't one of the approved da3wa templates, so the send just fails, and if
// it ever did resolve it would deliver a guest a message from WhatsApp's own
// documentation. So a placeholder name counts as "not configured" rather than
// as a usable template.
const PLACEHOLDER_TEMPLATE_NAMES = new Set(["hello_world", "changeme", "template_name"]);

/**
 * True only if this env value names a template we should actually try to send.
 * Callers should refuse to send (with a clear reason) when it returns false —
 * an unsent message can be fixed, a wrongly-sent one cannot.
 */
export function isUsableTemplateName(name) {
  const clean = String(name || "").trim().toLowerCase();
  return Boolean(clean) && !PLACEHOLDER_TEMPLATE_NAMES.has(clean);
}

function endpoint(path) {
  const base = process.env.WATI_API_ENDPOINT.replace(/\/$/, "");
  return `${base}${path}`;
}

function authHeaders() {
  const token = process.env.WATI_ACCESS_TOKEN;
  const bearer = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return {
    Authorization: bearer,
    "Content-Type": "application/json",
  };
}

// Normalizes a phone number to the digits-only, country-code-prefixed
// format Wati expects (e.g. "9665XXXXXXXX"), stripping "+", spaces and
// leading zeros after a country code where possible.
export function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

// Wati stores a template's text with positional placeholders ({{1}}, {{2}})
// and keeps the readable names in customParams, whose ORDER defines which
// placeholder each name fills. So a template knows exactly which parameters it
// wants, and how many.
//
// Callers here pass a superset — everything any configured template might ask
// for — because which template is active is an environment variable, not a
// code path. This looks the real list up and trims the superset down to it, in
// the declared order. Without that, main_msg (name, link) would receive five
// parameters and da3wa_qr_delivery four.
//
// Cached because a bulk send loops over every guest and the template list
// changes about as often as someone edits it in the Wati dashboard.
const TEMPLATE_CACHE_MS = 10 * 60 * 1000;
let templateCache = { at: 0, byName: null };

async function loadTemplates() {
  const now = Date.now();
  if (!templateCache.byName || now - templateCache.at > TEMPLATE_CACHE_MS) {
    const res = await fetch(endpoint("/api/v1/getMessageTemplates"), {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`getMessageTemplates ${res.status}`);
    const json = await res.json();
    const byName = new Map();
    for (const t of json.messageTemplates || []) {
      const name = t.elementName || t.name;
      if (!name) continue;
      byName.set(name, {
        status: String(t.status || "").toUpperCase(),
        paramNames: (t.customParams || []).map((p) => p.paramName).filter(Boolean),
      });
    }
    templateCache = { at: now, byName };
  }
  return templateCache.byName;
}

async function fetchTemplateParamNames(templateName) {
  const byName = await loadTemplates();
  return byName.get(templateName)?.paramNames || null;
}

/**
 * Checks a configured template name against the Wati account before anything
 * is sent. Meta only delivers APPROVED templates, so a name that is missing or
 * still in review fails per-guest with an opaque "Wati API error 400 … code:
 * Template" — repeated once for every guest in the batch. Catching it once,
 * up front, with the account's actual approved names in the message, turns
 * that into something the person clicking Send can act on.
 *
 * Returns null when everything is fine, or a ready-to-show Arabic reason.
 * Returns null too if the account can't be reached — never block a send over
 * a failed metadata lookup.
 */
export async function describeTemplateProblem(templateName) {
  if (!isConfigured()) return null;
  let byName;
  try {
    byName = await loadTemplates();
  } catch {
    return null;
  }

  const approved = [...byName.entries()]
    .filter(([, t]) => t.status === "APPROVED")
    .map(([name]) => name);
  const approvedList = approved.length ? approved.join("، ") : "لا يوجد أي قالب معتمد بعد";

  const found = byName.get(templateName);
  if (!found) {
    return `القالب "${templateName}" غير موجود في حساب Wati. القوالب المعتمدة حاليًا: ${approvedList}`;
  }
  if (found.status !== "APPROVED") {
    return `القالب "${templateName}" حالته ${found.status} — واتساب لا يرسل إلا القوالب المعتمدة. استخدم أحد المعتمدة حاليًا: ${approvedList}`;
  }
  return null;
}

/**
 * Narrows a superset of parameters to the ones this template declares, in the
 * order it declares them. Returns the original list untouched if the template
 * can't be looked up — a lookup problem should never block a send that would
 * otherwise have worked.
 */
async function alignParamsToTemplate(templateName, params) {
  let declared;
  try {
    declared = await fetchTemplateParamNames(templateName);
  } catch (err) {
    console.warn("[wati] could not read template parameters, sending as-is:", err.message);
    return params;
  }
  if (!declared || declared.length === 0) return params;

  const supplied = new Map(params.map((p) => [p.name, p.value]));
  return declared.map((name) => ({ name, value: supplied.get(name) ?? "" }));
}

async function callWati(path, body) {
  const res = await fetch(endpoint(path), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `Wati API error ${res.status}: ${JSON.stringify(json).slice(0, 500)}`
    );
  }
  return json;
}

/**
 * Sends a template message via Wati.
 * @param {string} phone - E.164-ish digits (no +).
 * @param {string} templateName - Must match an approved Meta template name.
 * @param {string} broadcastName - Free-text label Wati groups the send under.
 * @param {{type: 'text'|'currency'|'text', text: string}[]} params - Template variable values, in order.
 */
export async function sendTemplateMessage({ phone, templateName, broadcastName, params = [] }) {
  const normalized = normalizePhone(phone);
  if (!isConfigured()) {
    return {
      simulated: true,
      reason: "WATI_API_ENDPOINT / WATI_ACCESS_TOKEN not configured",
      phone: normalized,
      templateName,
      params,
    };
  }
  try {
    const body = {
      template_name: templateName,
      broadcast_name: broadcastName || templateName,
      parameters: await alignParamsToTemplate(templateName, params),
    };
    // Wati's v1 docs list channel_number as a required field on accounts
    // with more than one connected WhatsApp number. Only include it if the
    // account's number is configured, so single-channel accounts (which
    // work fine without it) aren't affected.
    if (process.env.WATI_CHANNEL_NUMBER) {
      body.channel_number = process.env.WATI_CHANNEL_NUMBER;
    }
    const result = await callWati(
      `/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(normalized)}`,
      body
    );
    return { simulated: false, result };
  } catch (err) {
    return { simulated: false, error: err.message };
  }
}

/**
 * Sends a plain session (free-form) text message via Wati. Only reliably
 * delivers within an open 24h customer-service window.
 */
export async function sendSessionMessage({ phone, text }) {
  const normalized = normalizePhone(phone);
  if (!isConfigured()) {
    return {
      simulated: true,
      reason: "WATI_API_ENDPOINT / WATI_ACCESS_TOKEN not configured",
      phone: normalized,
      text,
    };
  }
  try {
    // Wati's v1 "sendSessionMessage" endpoint reads the message text from a
    // URL query parameter (messageText), NOT the JSON body — sending it only
    // in the body (as an earlier version of this function did) results in a
    // 200 OK with no actual message delivered, since Wati receives an empty
    // messageText. We send it as a query param to match Wati's actual
    // contract, and keep it in the body too for harmless redundancy.
    const result = await callWati(
      `/api/v1/sendSessionMessage/${encodeURIComponent(normalized)}?messageText=${encodeURIComponent(text)}`,
      { messageText: text }
    );
    return { simulated: false, result };
  } catch (err) {
    return { simulated: false, error: err.message };
  }
}

export function watiIsConfigured() {
  return isConfigured();
}
