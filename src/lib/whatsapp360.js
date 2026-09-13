// Client for 360dialog — a WhatsApp Business Solution Provider that hosts the
// Cloud API.
//
// Meta wouldn't take the card on Da3wa's own WhatsApp account (health error
// 141006, and no charge was ever attempted), so sending straight to Meta can't
// go live. A provider like 360dialog pays Meta itself and bills a prepaid
// balance, which takes the card out of Meta's hands. It was picked over the
// other providers because its API is the Cloud API: the same message payload,
// the same template objects, and Meta's fees passed through without a markup.
// Only the host and the auth header differ, and that is all this file supplies
// — sending and template handling come from src/lib/cloudApiClient.js, shared
// with the Meta client.
//
// Environment:
//   D360_API_KEY                the channel's API key from the 360dialog hub
//   D360_API_URL                optional, defaults to production. A sandbox key
//                               (send START on WhatsApp to +55 11 4673-3492) uses
//                               https://waba-sandbox.360dialog.io/v1 — it only
//                               reaches the number that asked for it, offers
//                               three fixed templates and stops after 200 messages.
//   WHATSAPP_TEMPLATE_LANGUAGE  shared with the Meta client, defaults to "ar"
import { createCloudApiClient } from "@/lib/cloudApiClient";

const DEFAULT_API_URL = "https://waba-v2.360dialog.io";

function config() {
  return {
    apiKey: process.env.D360_API_KEY || "",
    baseUrl: (process.env.D360_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ar",
  };
}

export function d360IsConfigured() {
  return Boolean(config().apiKey);
}

async function d360(path, { method = "GET", body } = {}) {
  const { apiKey, baseUrl } = config();
  // Paging links come back absolute. The API key travels with every request,
  // so an absolute URL is only followed on the configured 360dialog host.
  const absolute = /^https?:\/\//i.test(path);
  if (absolute && !path.startsWith(`${baseUrl}/`)) {
    throw new Error(`360dialog: رابط صفحة خارج ${baseUrl}`);
  }
  const res = await fetch(absolute ? path : `${baseUrl}/${path}`, {
    method,
    headers: {
      "D360-API-KEY": apiKey,
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
    // 360dialog's reference documents its errors as {"error": "…"}; failures
    // Meta reports come as Meta's error object. Either is read, so the admin
    // feed gets the sentence rather than a status code.
    const e = typeof json.error === "string" ? { message: json.error } : json.error || {};
    const detail = e.error_data?.details;
    throw new Error(
      `360dialog ${res.status}${e.code ? ` (#${e.code})` : ""}: ` +
        `${e.message || String(text).slice(0, 300)}${detail ? ` — ${detail}` : ""}`
    );
  }
  return json;
}

const client = createCloudApiClient({
  label: "whatsapp-360dialog",
  isConfigured: d360IsConfigured,
  notConfiguredReason: "D360_API_KEY not configured",
  request: d360,
  // The key already identifies the number, so unlike Meta there's no phone
  // number id in the path.
  messagesPath: () => "messages",
  templatesPath: () => "message_templates?fields=name,status,language,parameter_format,components&limit=100",
  language: () => config().language,
});

export const listAccountTemplates = client.listAccountTemplates;
export const describeTemplateProblem = client.describeTemplateProblem;
export const sendTemplateMessage = client.sendTemplateMessage;
export const sendSessionMessage = client.sendSessionMessage;
