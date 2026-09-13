// The part of a WhatsApp client that doesn't depend on who carries the request.
//
// Meta's Cloud API and 360dialog take the same message payload and return the
// same template objects — 360dialog hosts the Cloud API behind its own address
// and API key. What differs between them is only how a request is made: the
// host, the auth header, and whether the sending number's id is in the path.
// Each provider file supplies that (src/lib/whatsappCloud.js,
// src/lib/whatsapp360.js); everything else lives here, so a rule about
// templates is written once and holds for both.
//
// Zoko's payload is different, but it fills a numbered template from the same
// declared order, which is why positionalOrderFor is exported too.

// Numbered templates, and the names their numbers stand for.
//
// The approved da3wa templates are positional on Meta ({{1}}, {{2}} …) even
// though they were written with names: Wati keeps the readable names in its own
// layer and submits numbers. Resubmitting them with named variables would mean
// another Meta review before a single invitation can go out, so instead the
// order is written down here — explicitly, per template, never inferred.
//
// Each list was checked against the approved body text and Meta's own example
// values (11 Sep 2026): da3wa_invite_link reads "مرحباً {{1}} … يتشرف {{2}}
// و{{3}} … {{4}}" with example [guest, groom, bride, link].
//
// If Meta's count ever differs from the list, the send is refused. A template
// edited in WhatsApp Manager with a variable added or reordered should stop
// sends, not quietly put a guest's link where their name belongs.
//
// WHATSAPP_POSITIONAL_PARAM_ORDER can add or override entries as JSON, e.g.
// {"new_template":["name","link"]}, without a deploy of this file.
const POSITIONAL_PARAM_ORDER = {
  da3wa_invite_link: ["name", "groom", "bride", "link"],
  da3wa_qr_delivery: ["name", "groom", "bride"],
  da3wa_event_reminder: ["name", "groom", "bride", "date", "time", "venue", "maplink"],
  main_msg: ["name", "link"],
};

export function positionalOrderFor(templateName) {
  const raw = process.env.WHATSAPP_POSITIONAL_PARAM_ORDER;
  if (raw) {
    try {
      const override = JSON.parse(raw);
      if (Array.isArray(override?.[templateName])) return override[templateName];
    } catch {
      console.warn("[whatsapp] WHATSAPP_POSITIONAL_PARAM_ORDER is not valid JSON; ignoring it");
    }
  }
  return POSITIONAL_PARAM_ORDER[templateName] || null;
}

export function digitsOnly(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

// A template's body declares its variables inline — {{name}} for a template
// created with named parameters, {{1}} for a positional one. The routes pass a
// superset of values (everything any configured template might ask for), and
// the declared names decide which of them are sent. Same approach as the Wati
// client, which read the same thing out of customParams.
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

// Cached for ten minutes: a bulk send loops over every guest, and templates
// change about as often as someone edits one in WhatsApp Manager.
const TEMPLATE_CACHE_MS = 10 * 60 * 1000;

/**
 * Builds a client with the same exports as src/lib/wati.js, name for name and
 * shape for shape ({ simulated, error, messageId, … }).
 *
 * @param {object}   p
 * @param {string}   p.label               prefix for log lines
 * @param {() => boolean} p.isConfigured
 * @param {string}   p.notConfiguredReason returned with simulated sends
 * @param {(path: string, opts?: {method?: string, body?: object}) => Promise<object>} p.request
 *        resolves with parsed JSON; throws an Error worded for the admin feed.
 *        Must accept the absolute paging.next links the provider returns.
 * @param {() => string} p.messagesPath
 * @param {() => string} p.templatesPath   first page of the template list; may throw when unset
 * @param {() => string} p.language        preferred template language
 */
export function createCloudApiClient({
  label,
  isConfigured,
  notConfiguredReason,
  request,
  messagesPath,
  templatesPath,
  language,
}) {
  let templateCache = { at: 0, byName: null };

  async function loadTemplates() {
    const now = Date.now();
    if (templateCache.byName && now - templateCache.at < TEMPLATE_CACHE_MS) {
      return templateCache.byName;
    }

    const preferred = language();
    const byName = new Map();
    let path = templatesPath();
    while (path) {
      const json = await request(path);
      for (const t of json.data || []) {
        if (!t.name) continue;
        // One name can exist in several languages. The configured language
        // wins; otherwise the first one seen is kept, so a template that only
        // exists in English is still found and reported rather than called
        // missing.
        if (!byName.has(t.name) || t.language === preferred) {
          byName.set(t.name, readTemplate(t));
        }
      }
      path = json.paging?.next || null;
    }

    templateCache = { at: now, byName };
    return byName;
  }

  /** The account's templates as a Map of name -> { status, paramNames, language }. Throws if the account can't be read. */
  async function listAccountTemplates() {
    return loadTemplates();
  }

  /**
   * Checked once before a bulk send, so a missing or unapproved template fails
   * with one clear sentence instead of once per guest. Returns null when the
   * template is usable — or when the account can't be read at all, because a
   * failed metadata lookup should never block a send that would have worked.
   */
  async function describeTemplateProblem(templateName) {
    if (!isConfigured()) return null;
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
      const order = positionalOrderFor(templateName);
      if (!order) {
        return `القالب "${templateName}" متغيراته بالأرقام ({{1}}) ومفيش ترتيب معرّف له في النظام — أضفه لـ POSITIONAL_PARAM_ORDER أو أنشئ القالب بمتغيرات بالأسماء`;
      }
      if (order.length !== found.paramNames.length) {
        return `القالب "${templateName}" فيه ${found.paramNames.length} متغيرات عند Meta والترتيب المعرّف ${order.length} — غالبًا القالب اتعدل، راجع الترتيب قبل الإرسال`;
      }
    }
    return null;
  }

  /**
   * Sends an approved template.
   * @param {string} phone        any format; reduced to digits
   * @param {string} templateName an APPROVED template on the account
   * @param {{name: string, value: string}[]} params superset of values, matched by name
   */
  async function sendTemplateMessage({ phone, templateName, params = [] }) {
    const to = digitsOnly(phone);
    if (!isConfigured()) {
      return { simulated: true, reason: notConfiguredReason, phone: to, templateName, params };
    }

    try {
      let found = null;
      try {
        found = (await loadTemplates()).get(templateName) || null;
      } catch (err) {
        console.warn(`[${label}] could not read templates, sending without parameter matching:`, err.message);
      }

      const template = { name: templateName, language: { code: found?.language || language() } };

      if (found?.paramNames.length) {
        const supplied = new Map(params.map((p) => [p.name, p.value]));

        // Named templates say which value goes where themselves. Numbered ones
        // only get sent when their order is declared, and only when that order
        // has exactly as many entries as the account's copy has variables.
        let names = found.paramNames;
        if (found.positional) {
          const order = positionalOrderFor(templateName);
          if (!order || order.length !== found.paramNames.length) {
            return {
              simulated: false,
              error:
                (await describeTemplateProblem(templateName)) ||
                `القالب "${templateName}" متغيراته بالأرقام ومفيش ترتيب مطابق له`,
            };
          }
          names = order;
        }

        const missing = names.filter((n) => !String(supplied.get(n) ?? "").trim());
        if (missing.length) {
          // Meta rejects an empty parameter anyway; saying which one is empty
          // is the useful part.
          return { simulated: false, error: `قيم ناقصة للقالب "${templateName}": ${missing.join("، ")}` };
        }

        template.components = [
          {
            type: "body",
            parameters: names.map((n) =>
              found.positional
                ? { type: "text", text: String(supplied.get(n)) }
                : { type: "text", parameter_name: n, text: String(supplied.get(n)) }
            ),
          },
        ];
      }

      const result = await request(messagesPath(), {
        method: "POST",
        body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template },
      });

      // Accepted is not delivered. The message is queued and the real outcome
      // arrives later over the webhook; the wamid is what ties that report
      // back to this send.
      return { simulated: false, result, messageId: result?.messages?.[0]?.id || null, phone: to };
    } catch (err) {
      return { simulated: false, error: err.message };
    }
  }

  /**
   * Free-form text. WhatsApp only delivers it inside the 24-hour window that
   * opens when the recipient messages the business, so it's for replies and
   * tests — never for first contact with a guest.
   */
  async function sendSessionMessage({ phone, text }) {
    const to = digitsOnly(phone);
    if (!isConfigured()) {
      return { simulated: true, reason: notConfiguredReason, phone: to, text };
    }
    try {
      const result = await request(messagesPath(), {
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

  return { listAccountTemplates, describeTemplateProblem, sendTemplateMessage, sendSessionMessage };
}
