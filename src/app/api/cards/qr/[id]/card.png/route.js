import { buildQrCard } from "@/lib/cards";
import { verifyInviteToken } from "@/lib/token";

// The guest's entry pass as an image.
//
// Public on purpose: WhatsApp fetches a template's header image from Meta's
// own servers, with no cookie and no header we control, so the guest's invite
// token in the query string is the whole check. It is the same token that
// already opens their invitation, so this exposes nothing their link doesn't.
//
// The path ends in .png because some providers (Wati among them) validate the
// extension before they ever look at the content type.
export const runtime = "nodejs";
// A cold start has to download and boot Chromium before it draws anything.
export const maxDuration = 60;

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  if (!verifyInviteToken(id, searchParams.get("t"))) {
    return new Response("Not found", { status: 404 });
  }

  const card = await buildQrCard(id, searchParams.get("lang"));
  if (!card) return new Response("Not found", { status: 404 });

  return new Response(card.png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(card.png.length),
      // Meta caches header media it has already fetched; this tells every
      // hop in between that the card for a given URL never changes (a card
      // that does change gets a different cache key upstream anyway).
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
