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
      parameters: params,
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
    const result = await callWati(
      `/api/v1/sendSessionMessage/${encodeURIComponent(normalized)}`,
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
