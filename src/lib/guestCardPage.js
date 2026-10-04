import { getDb } from "@/lib/db";
import { verifyGuestPageToken, makeInviteToken, makeCardToken } from "@/lib/token";
import { siteOrigin, PRIVATE_ROUTE_METADATA } from "@/lib/seo";
import { coupleNamesIn } from "@/lib/couple";

// Shared by the two pages a hand-sent message links to: the entry pass
// (/pass/<guest>) and the thank-you card (/thanks/<guest>). Each shows the
// same card WhatsApp would have attached, and names it as the link's preview
// image, so the message shows the card itself before anyone taps it.
export async function loadGuestCard(purpose, id, token) {
  if (!verifyGuestPageToken(id, purpose, token)) return null;
  const db = await getDb();
  const guest = db.guests.find((g) => g.id === id);
  const event = guest && db.events.find((e) => e.id === guest.eventId);
  if (!guest || !event) return null;
  if (purpose === "pass" && guest.status !== "confirmed") return null;

  const lang = guest.language === "en" ? "en" : "ar";
  const base = siteOrigin();
  const image =
    purpose === "pass"
      ? `${base}/api/cards/qr/${guest.id}/card.png?t=${makeInviteToken(guest.id)}`
      : `${base}/api/cards/thanks/${event.id}/card.png?lang=${lang}&t=${makeCardToken(event.id)}`;
  return { guest, event, lang, image, couple: coupleNamesIn(event, lang) };
}

export function cardPageMetadata(card, title) {
  if (!card) return PRIVATE_ROUTE_METADATA;
  return {
    ...PRIVATE_ROUTE_METADATA,
    title,
    openGraph: {
      title,
      images: [{ url: card.image, width: 1080, height: 1350 }],
    },
  };
}
