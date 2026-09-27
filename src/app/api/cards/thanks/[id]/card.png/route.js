import { buildThanksCard } from "@/lib/cards";
import { verifyCardToken } from "@/lib/token";

// The wedding's thank-you card as an image, one per language. Same reasoning
// as the entry pass next door: WhatsApp fetches this itself, so the signed
// token in the query string is the check.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  if (!verifyCardToken(id, searchParams.get("t"))) {
    return new Response("Not found", { status: 404 });
  }

  const card = await buildThanksCard(id, searchParams.get("lang") || "ar");
  if (!card) return new Response("Not found", { status: 404 });

  return new Response(card.png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(card.png.length),
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
