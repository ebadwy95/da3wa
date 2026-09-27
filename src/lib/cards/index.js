// The two WhatsApp cards, from the database to a PNG.
//
// Each card is a pure function of what is on it: build the HTML, hash it, and
// the hash is the cache key. An admin who fixes the venue's spelling gets a
// new hash and therefore a new card, with no cache to remember to clear; a
// second request for an unchanged card never renders twice.

import QRCode from "qrcode";
import { getDb, getCacheClient } from "@/lib/db";
import { makeCheckinCode } from "@/lib/token";
import { resolveInviteCopy, normaliseInviteLanguage } from "@/lib/inviteCopy";
import { resolveCoupleParts, joinCoupleNames } from "@/lib/couple";
import { formatEventDateArabic, formatEventTimeArabic } from "@/lib/date";
import { qrCardHtml, thanksCardHtml, CARD_WIDTH, CARD_HEIGHT } from "./scene";
import { renderHtmlToPng } from "./render";

// Long enough that a wedding's cards survive the week around it, short enough
// that last season's guests are not still sitting in a 256MB free tier.
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function renderCached(key, html, locale) {
  const redis = await getCacheClient();
  if (redis) {
    const hit = await redis.get(key).catch(() => null);
    if (hit) return Buffer.from(hit, "base64");
  }
  const png = await renderHtmlToPng(html, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    locale,
  });
  if (redis) {
    await redis
      .set(key, Buffer.from(png).toString("base64"), { ex: CACHE_TTL_SECONDS })
      .catch(() => {});
  }
  return png;
}

/** The English card carries the English spellings when the couple wrote them. */
function coupleNamesFor(event, lang) {
  if (lang === "en") {
    const latin = String(event.latinNames || "").trim();
    if (latin) return latin;
  }
  return event.coupleNames || joinCoupleNames(event.groomName, event.brideName) || "";
}

function venueFor(event, lang) {
  if (lang === "en") {
    const en = String(event.venueNameEn || "").trim();
    if (en) return en;
  }
  return event.venueName || "";
}

function dateLineFor(event, lang) {
  if (lang === "en") {
    const parts = [];
    try {
      parts.push(
        new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${event.eventDate}T00:00:00`))
      );
    } catch {
      parts.push(event.eventDate || "");
    }
    const [h, m] = String(event.eventTime || "").split(":");
    if (h !== undefined && m !== undefined) {
      const hour = Number(h) % 12 === 0 ? 12 : Number(h) % 12;
      parts.push(`${hour}:${m} ${Number(h) >= 12 ? "PM" : "AM"}`);
    }
    return parts.filter(Boolean).join(" — ");
  }
  return [formatEventDateArabic(event.eventDate), formatEventTimeArabic(event.eventTime)]
    .filter(Boolean)
    .join(" — ");
}

function seatsLine(guest, lang) {
  // What the door will actually admit: the guest plus the companions they
  // confirmed, falling back to their allowance before they answer.
  const total =
    1 +
    (Number.isFinite(guest.confirmedCompanions) && guest.confirmedCompanions !== null
      ? guest.confirmedCompanions
      : guest.maxCompanions || 0);
  if (total <= 1) return lang === "en" ? "Admits 1" : "لشخص واحد";
  return lang === "en" ? `Admits ${total}` : `يشمل ${total} أشخاص`;
}

/** Language of a guest's own card: what the admin chose for them, else Arabic. */
export function guestLanguage(guest) {
  return normaliseInviteLanguage(guest?.language) || "ar";
}

/**
 * The entry pass for one guest. Returns null when the guest (or their wedding)
 * no longer exists, so a stale link 404s instead of throwing.
 */
export async function buildQrCard(guestId, langOverride) {
  const db = await getDb();
  const guest = db.guests.find((g) => g.id === guestId);
  if (!guest) return null;
  const event = db.events.find((e) => e.id === guest.eventId);
  if (!event) return null;

  const lang = normaliseInviteLanguage(langOverride) || guestLanguage(guest);
  const copy = resolveInviteCopy(lang === "en" ? event.inviteCopyEn : event.inviteCopy, lang);

  // Rendered at 720px into a 430px box: the code is the one thing on this card
  // that has to survive a phone camera, and a downscaled code stays crisp
  // where an upscaled one turns to mush.
  const qr = await QRCode.toDataURL(makeCheckinCode(guest.id), {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 720,
    color: { dark: "#2c2620", light: "#ffffff" },
  });

  const html = qrCardHtml({
    lang,
    qr,
    coupleNames: coupleNamesFor(event, lang),
    guestName: guest.name,
    seats: seatsLine(guest, lang),
    dateLine: dateLineFor(event, lang),
    venueLine: venueFor(event, lang),
    note: copy.qrCardNote,
  });

  const png = await renderCached(`da3wa:card:qr:${guest.id}:${hash(html)}`, html, lang);
  return { png, lang };
}

/** The thank-you card for a wedding — one per language, not one per guest. */
export async function buildThanksCard(eventId, lang = "ar") {
  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return null;

  const language = normaliseInviteLanguage(lang) || "ar";
  const copy = resolveInviteCopy(
    language === "en" ? event.inviteCopyEn : event.inviteCopy,
    language
  );

  const html = thanksCardHtml({
    lang: language,
    headline: copy.thanksHeadline,
    body: copy.thanksBody,
    coupleNames: coupleNamesFor(event, language),
    dateLine: dateLineFor(event, language).split(" — ")[0],
  });

  const png = await renderCached(
    `da3wa:card:thanks:${event.id}:${language}:${hash(html)}`,
    html,
    language
  );
  return { png, lang: language };
}

/** Absolute, public, and stable — the URL WhatsApp fetches the image from. */
export function cardUrls(origin, { guestId, token, eventId, lang }) {
  const base = String(origin || "").replace(/\/$/, "");
  if (guestId) {
    return `${base}/api/cards/qr/${guestId}/card.png?t=${encodeURIComponent(token)}`;
  }
  return `${base}/api/cards/thanks/${eventId}/card.png?lang=${lang === "en" ? "en" : "ar"}&t=${encodeURIComponent(token)}`;
}

export { resolveCoupleParts };
