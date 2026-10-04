import { loadGuestCard, cardPageMetadata } from "@/lib/guestCardPage";
import GuestCardView from "@/components/GuestCardView";

// A guest's entry pass, as a link: what a hand-sent QR message points to.
export const dynamic = "force-dynamic";

async function load(params, searchParams) {
  const { id } = await params;
  const { t } = await searchParams;
  return { card: await loadGuestCard("pass", id, t), token: t };
}

export async function generateMetadata({ params, searchParams }) {
  const { card } = await load(params, searchParams);
  return cardPageMetadata(card, card?.lang === "en" ? "Your entry pass" : "بطاقة الدخول");
}

export default async function PassPage({ params, searchParams }) {
  const { card, token } = await load(params, searchParams);
  const en = card?.lang === "en";
  return (
    <GuestCardView
      card={card}
      purpose="pass"
      token={token}
      title={en ? "Your entry pass" : "بطاقة الدخول"}
      note={
        en
          ? "Show this card at the venue entrance. Press and hold it to save it to your photos."
          : "أبرز هذي البطاقة عند بوابة القاعة. اضغط عليها ضغطة طويلة علشان تحفظها في الصور."
      }
    />
  );
}
