// The two WhatsApp cards, from the database to a PNG.
//
// Each card is a pure function of what is on it: build the HTML, hash it, and
// the hash is the cache key. An admin who fixes the venue's spelling gets a
// new hash and therefore a new card, with no cache to remember to clear; a
// second request for an unchanged card never renders twice.

import QRCode from "qrcode";
import { getDb, getCacheClient } from "@/lib/db";
import { makeCheckinCode } from "@/lib/token";
import { resolveInviteCopy, normaliseInviteLanguage, guestLanguage } from "@/lib/inviteCopy";
import { coupleNamesIn } from "@/lib/couple";
import {
  formatEventDateArabic,
  formatEventTimeArabic,
  formatEventDateEnglish,
  formatEventTimeEnglish,
} from "@/lib/date";
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

function venueFor(event, lang) {
  if (lang === "en") {
    const en = String(event.venueNameEn || "").trim();
    if (en) return en;
  }
  return event.venueName || "";
}

function dateLineFor(event, lang) {
  const [date, time] =
    lang === "en"
      ? [formatEventDateEnglish(event.eventDate), formatEventTimeEnglish(event.eventTime)]
      : [formatEventDateArabic(event.eventDate), formatEventTimeArabic(event.eventTime)];
  return [date, time].filter(Boolean).join(" — ");
}

// What the door will actually admit: the guest plus the companions they
// confirmed. Never the allowance — a guest invited for four who confirms two
// must not walk in holding a card that says four.
//
// Said as a rule rather than a description ("admits 3 only", not "3 people"),
// with the figure in brackets as well. The person reading this is a steward
// at a door with a queue behind it, deciding in a second whether the four
// people in front of them may all come in; a card that merely mentions a
// number leaves that argument to them.
function seatsLine(guest, lang) {
  const total = 1 + (Number(guest.confirmedCompanions) || 0);
  if (lang === "en") return `Admits (${total}) only`;
  // Arabic counts its nouns: one and two have their own forms, three to ten
  // take the plural, and eleven upwards go back to the singular.
  if (total <= 1) return "يُسمح بدخول شخص واحد فقط";
  if (total === 2) return "يُسمح بدخول شخصين فقط";
  if (total <= 10) return `يُسمح بدخول (${total}) أشخاص فقط`;
  return `يُسمح بدخول (${total}) شخصًا فقط`;
}

// Why that is the number, under it in smaller type: it is the guest's own
// answer, not a limit anyone set for them. Saves the door the conversation.
function seatsNote(lang) {
  return lang === "en" ? "as confirmed in your reply" : "حسب ما أكّدتموه عند الرد";
}

/**
 * The entry pass for one guest. Returns null when the guest (or their wedding)
 * no longer exists, so a stale link 404s instead of throwing — and also until
 * the guest has confirmed: the card is made from their answer (how many are
 * coming), so before they give one there is no card to make.
 */
export async function buildQrCard(guestId, langOverride) {
  const db = await getDb();
  const guest = db.guests.find((g) => g.id === guestId);
  if (!guest || guest.status !== "confirmed") return null;
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
    coupleNames: coupleNamesIn(event, lang),
    guestName: guest.name,
    seats: seatsLine(guest, lang),
    seatsNote: seatsNote(lang),
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
    coupleNames: coupleNamesIn(event, language),
    dateLine:
      language === "en"
        ? formatEventDateEnglish(event.eventDate)
        : formatEventDateArabic(event.eventDate),
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

