import { loadGuestCard, cardPageMetadata } from "@/lib/guestCardPage";
import GuestCardView from "@/components/GuestCardView";

// The thank-you card, as a link: what a hand-sent thank-you points to.
export const dynamic = "force-dynamic";

async function load(params, searchParams) {
  const { id } = await params;
  const { t } = await searchParams;
  return { card: await loadGuestCard("thanks", id, t), token: t };
}

export async function generateMetadata({ params, searchParams }) {
  const { card } = await load(params, searchParams);
  return cardPageMetadata(card, card?.lang === "en" ? "Thank you" : "شكرًا لحضوركم");
}

export default async function ThanksPage({ params, searchParams }) {
  const { card, token } = await load(params, searchParams);
  const en = card?.lang === "en";
  return (
    <GuestCardView
      card={card}
      purpose="thanks"
      token={token}
      title={en ? "Thank you" : "شكرًا لحضوركم"}
      note={en ? `With love, ${card?.couple || ""}` : `مع خالص المحبة، ${card?.couple || ""}`}
    />
  );
}
