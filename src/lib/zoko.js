// Client for Zoko — a WhatsApp inbox provider in the same family as Wati,
// being trialled while Meta's payment block keeps the direct Cloud API route
// closed.
//
// Zoko's API has its own shape rather than the Cloud API's: a template goes out
// as its name plus a flat list of values that fill {{1}}, {{2}} … in order.
// Zoko's API reference has no endpoint for reading the account's templates
// (checked Sep 2026), so nothing here can see a template's status or count its
// variables before sending. The order therefore has to be declared — the same
// table the Cloud API clients use (src/lib/cloudApiClient.js) plus
// WHATSAPP_POSITIONAL_PARAM_ORDER — and a template without one is refused
// rather than sent with values in guessed positions. A template with no
// variables is declared as [].
//
// Delivery reports come over Zoko's webhooks, which aren't connected yet, so a
// send through Zoko shows as sent and goes no further in the log.
//
// Environment:
//   ZOKO_API_KEY   the account's API key
//   ZOKO_API_URL   optional, defaults to https://chat.zoko.io/v2
import { digitsOnly, positionalOrderFor } from "@/lib/cloudApiClient";

const DEFAULT_API_URL = "https://chat.zoko.io/v2";

function config() {
  return {
    apiKey: process.env.ZOKO_API_KEY || "",
    baseUrl: (process.env.ZOKO_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
  };
}

export function zokoIsConfigured() {
  return Boolean(config().apiKey);
}

async function postMessage(body) {
  const { apiKey, baseUrl } = config();
  const res = await fetch(`${baseUrl}/message`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const message = json.message || json.error || json.statusText || String(text).slice(0, 300);
    throw new Error(`Zoko API ${res.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`);
  }
  return json;
}

/** Zoko can't list templates over its API; the error says so, for the diagnostics panel. */
export async function listAccountTemplates() {
  throw new Error("Zoko لا يتيح قراءة القوالب عبر الـ API — راجع القوالب وحالتها من لوحة Zoko");
}

/** Only the part Zoko lets us check: that the template has a declared variable order. */
export async function describeTemplateProblem(templateName) {
  if (!zokoIsConfigured()) return null;
  if (!positionalOrderFor(templateName)) {
    return `القالب "${templateName}" مالوش ترتيب متغيرات معرّف — Zoko بيبعت القيم بالترتيب، فأضفه لـ WHATSAPP_POSITIONAL_PARAM_ORDER (أو [] لو القالب من غير متغيرات)`;
  }
  return null;
}

/**
 * Sends a template approved on the Zoko account.
 * @param {string} phone        any format; reduced to digits
 * @param {string} templateName the template's name, which Zoko calls templateId
 * @param {{name: string, value: string}[]} params superset of values, matched by name
 */
export async function sendTemplateMessage({ phone, templateName, params = [] }) {
  const to = digitsOnly(phone);
  if (!zokoIsConfigured()) {
    return { simulated: true, reason: "ZOKO_API_KEY not configured", phone: to, templateName, params };
  }

  const order = positionalOrderFor(templateName);
  if (!order) {
    return { simulated: false, error: await describeTemplateProblem(templateName) };
  }
  const supplied = new Map(params.map((p) => [p.name, p.value]));
  const missing = order.filter((n) => !String(supplied.get(n) ?? "").trim());
  if (missing.length) {
    return { simulated: false, error: `قيم ناقصة للقالب "${templateName}": ${missing.join("، ")}` };
  }

  try {
    const result = await postMessage({
      channel: "whatsapp",
      recipient: to,
      type: "template",
      templateId: templateName,
      templateArgs: order.map((n) => String(supplied.get(n))),
    });
    return { simulated: false, result, messageId: result?.messageId || null, phone: to };
  } catch (err) {
    return { simulated: false, error: err.message };
  }
}

/** Free-form text; like any provider, only delivered inside the guest's 24-hour window. */
export async function sendSessionMessage({ phone, text }) {
  const to = digitsOnly(phone);
  if (!zokoIsConfigured()) {
    return { simulated: true, reason: "ZOKO_API_KEY not configured", phone: to, text };
  }
  try {
    const result = await postMessage({ channel: "whatsapp", recipient: to, type: "text", message: text });
    return { simulated: false, result, messageId: result?.messageId || null, phone: to };
  } catch (err) {
    return { simulated: false, error: err.message };
  }
}
