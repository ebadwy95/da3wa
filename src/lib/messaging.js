import * as cloud from "@/lib/whatsappCloud";
import * as wati from "@/lib/wati";

// The one place the rest of the app sends WhatsApp messages through.
//
// Two providers sit behind it: Meta's Cloud API directly, and Wati. Routes
// import from here and never from either client, so moving between them is a
// matter of environment variables rather than a code change — which is exactly
// what happened when Wati's trial lapsed mid-season.
//
// Cloud wins whenever it is configured, even if Wati's variables are still
// set. Production still holds Wati's old token; without this ordering, the
// dead provider would keep being chosen for as long as nobody deleted it.

export { isUsableTemplateName } from "@/lib/wati";

/** "cloud" | "wati" | "none" */
export function messagingProvider() {
  if (cloud.cloudIsConfigured()) return "cloud";
  if (wati.watiIsConfigured()) return "wati";
  return "none";
}

function active() {
  return messagingProvider() === "wati" ? wati : cloud;
}

export function messagingIsConfigured() {
  return messagingProvider() !== "none";
}

/**
 * Which environment variable names the template for a kind of message —
 * "INVITE", "QR" or "REMINDER". The provider-neutral WHATSAPP_* name is
 * preferred; the old WATI_* name is still read so a deployment that only has
 * those keeps working until it's tidied up. When neither is set, the WHATSAPP_*
 * name is returned, since that is the one to set.
 */
export function templateEnvFor(kind) {
  const neutral = `WHATSAPP_${kind}_TEMPLATE_NAME`;
  const legacy = `WATI_${kind}_TEMPLATE_NAME`;
  if (process.env[neutral]) return neutral;
  if (process.env[legacy]) return legacy;
  return neutral;
}

export function templateNameFor(kind) {
  return process.env[templateEnvFor(kind)] || "";
}

export function sendTemplateMessage(args) {
  return active().sendTemplateMessage(args);
}

export function sendSessionMessage(args) {
  return active().sendSessionMessage(args);
}

export function listAccountTemplates() {
  return active().listAccountTemplates();
}

export function describeTemplateProblem(templateName) {
  return active().describeTemplateProblem(templateName);
}
