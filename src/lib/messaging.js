import * as cloud from "@/lib/whatsappCloud";
import * as d360 from "@/lib/whatsapp360";
import * as zoko from "@/lib/zoko";
import * as wati from "@/lib/wati";

// The one place the rest of the app sends WhatsApp messages through.
//
// Four providers sit behind it: Meta's Cloud API directly; 360dialog and Zoko,
// which pay Meta themselves and bill a prepaid balance; and Wati. Routes import
// from here and never from a client, so moving between them is a matter of
// environment variables rather than a code change — which is exactly what
// happened when Wati's trial lapsed mid-season, and again when Meta wouldn't
// take the card on the direct account.
//
// WHATSAPP_PROVIDER names the one to use. Trying a provider meant switching to
// it without first deleting another's credentials. When it names a provider
// whose variables are missing, nothing is used: a deployment told to send
// through Zoko should say "not configured", not quietly send through something
// else.
//
// Without it, the first configured provider in PROVIDER_ORDER wins. Cloud comes
// before Wati even if Wati's variables are still set. Production still holds
// Wati's old token; without this ordering, the dead provider would keep being
// chosen for as long as nobody deleted it.

export { isUsableTemplateName } from "@/lib/wati";

const PROVIDERS = {
  cloud: { client: cloud, configured: cloud.cloudIsConfigured },
  "360dialog": { client: d360, configured: d360.d360IsConfigured },
  zoko: { client: zoko, configured: zoko.zokoIsConfigured },
  wati: { client: wati, configured: wati.watiIsConfigured },
};

const PROVIDER_ORDER = ["cloud", "360dialog", "zoko", "wati"];

/** "cloud" | "360dialog" | "zoko" | "wati" | "none" */
export function messagingProvider() {
  const chosen = String(process.env.WHATSAPP_PROVIDER || "").trim().toLowerCase();
  if (chosen) return PROVIDERS[chosen]?.configured() ? chosen : "none";
  return PROVIDER_ORDER.find((name) => PROVIDERS[name].configured()) || "none";
}

function active() {
  return PROVIDERS[messagingProvider()]?.client || cloud;
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
