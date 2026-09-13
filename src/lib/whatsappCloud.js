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
// This file only says how to reach Meta. Template reading, the positional
// parameter order and the send payloads are in src/lib/cloudApiClient.js,
// shared with 360dialog, which carries the same API through its own host.
// src/lib/messaging.js picks which provider is used.
//
// Environment:
//   WHATSAPP_CLOUD_TOKEN        System User access token (permanent)
//   WHATSAPP_PHONE_NUMBER_ID    the sending number's id — not the number itself
//   WHATSAPP_WABA_ID            WhatsApp Business Account id, for reading templates
//   WHATSAPP_GRAPH_VERSION      optional, defaults below
//   WHATSAPP_TEMPLATE_LANGUAGE  optional, defaults to "ar"
import { createCloudApiClient } from "@/lib/cloudApiClient";

// v25.0 is supported until July 2028. Pinned rather than "latest" because Meta
// changes payloads between versions, and a silent version bump is not a thing
// anyone would think to look for when invitations stop arriving.
const DEFAULT_GRAPH_VERSION = "v25.0";
const GRAPH_HOST = "https://graph.facebook.com/";

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

async function graph(path, { method = "GET", body } = {}) {
  const { token, version } = config();
  // Paging links come back absolute. The token travels with every request, so
  // an absolute URL is only followed on Meta's own host.
  const absolute = /^https?:\/\//i.test(path);
  if (absolute && !path.startsWith(GRAPH_HOST)) {
    throw new Error("WhatsApp Cloud API: رابط صفحة خارج graph.facebook.com");
  }
  const res = await fetch(absolute ? path : `${GRAPH_HOST}${version}/${path}`, {
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

const client = createCloudApiClient({
  label: "whatsapp-cloud",
  isConfigured: cloudIsConfigured,
  notConfiguredReason: "WHATSAPP_CLOUD_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured",
  request: graph,
  messagesPath: () => `${config().phoneNumberId}/messages`,
  templatesPath: () => {
    const { wabaId } = config();
    if (!wabaId) throw new Error("WHATSAPP_WABA_ID غير مضبوط");
    return `${wabaId}/message_templates?fields=name,status,language,parameter_format,components&limit=100`;
  },
  language: () => config().language,
});

export const listAccountTemplates = client.listAccountTemplates;
export const describeTemplateProblem = client.describeTemplateProblem;
export const sendTemplateMessage = client.sendTemplateMessage;
export const sendSessionMessage = client.sendSessionMessage;
