import GuestPageBeacon from "@/components/GuestPageBeacon";

// The page around a card: the card itself, as large as the screen allows,
// with one line underneath saying what to do with it.
export default function GuestCardView({ card, purpose, token, title, note }) {
  if (!card) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <p className="meta">الرابط غير صالح</p>
      </main>
    );
  }
  const en = card.lang === "en";
  return (
    <main
      className="min-h-screen flex flex-col items-center gap-4 p-4"
      dir={en ? "ltr" : "rtl"}
      lang={en ? "en" : "ar"}
      style={{ background: "#17140f" }}
    >
      <GuestPageBeacon guestId={card.guest.id} purpose={purpose} token={token} />
      <p style={{ color: "#e0c48d", fontWeight: 700, marginTop: "0.5rem" }}>{title}</p>
      {/* A same-site path for the page itself; the absolute URL is for the
          link preview, which is fetched from somewhere else entirely. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={new URL(card.image).pathname + new URL(card.image).search}
        alt={title}
        width={1080}
        height={1350}
        style={{ width: "100%", maxWidth: "30rem", height: "auto", borderRadius: "1rem" }}
      />
      <p style={{ color: "#d9cbb0", fontSize: "0.9rem", textAlign: "center", maxWidth: "30rem", lineHeight: 1.7 }}>
        {note}
      </p>
    </main>
  );
}
