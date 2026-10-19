import QRCode from "qrcode";
import { ensureDemo, demoLeadGuestId, DEMO_EVENT_ID } from "@/lib/demo";
import { makeInviteToken } from "@/lib/token";
import { siteOrigin } from "@/lib/seo";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";
import DemoReset from "./DemoReset";

// The stand screen. Put this on a tablet at the booth, face out.
//
// Three codes, in the order a visitor should meet them: be a guest, be the
// door, be the couple. The first one is the whole sale — they confirm on
// their own phone and the number on this screen moves while they are still
// holding it — and the other two are there for the question that always
// comes next, which is "fine, but what do I get out of it".
export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_ROUTE_METADATA, title: "عرض دعوة — المعرض" };

async function qr(text) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: 520 });
}

export default async function DemoPage() {
  const { event } = await ensureDemo();
  const base = siteOrigin();
  const guestId = demoLeadGuestId();

  const tiles = [
    {
      key: "guest",
      step: "١",
      title: "كن ضيفًا",
      body: "امسح الرمز بجوالك. ستفتح دعوة حقيقية باسم ضيف — أكّد الحضور واختر عدد المرافقين، وسترى بطاقة دخولك تظهر في نفس اللحظة.",
      href: `${base}/invite/${guestId}?t=${makeInviteToken(guestId)}`,
    },
    {
      key: "door",
      step: "٢",
      title: "كن الباب",
      body: "سكانر البوابة. امسح بطاقة الضيف الذي أكّد للتو — ثم امسحها مرة ثانية وشاهد ماذا يحدث.",
      href: `${base}/scan?c=DEMO2026`,
    },
    {
      key: "couple",
      step: "٣",
      title: "كن صاحب الحفل",
      body: `لوحة الزفاف لحظة بلحظة. اسم الدخول "demo" وكلمة المرور "da3wa-demo".`,
      href: `${base}/couple`,
    },
  ];

  const codes = await Promise.all(tiles.map((t) => qr(t.href)));

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <section className="band-dark section" style={{ paddingBlock: "clamp(2.5rem,6vw,4rem)" }}>
        <div className="aurora" aria-hidden="true" />
        <div className="pattern-veil" aria-hidden="true" />
        <div className="wrap relative text-center flex flex-col gap-3">
          <span className="hero-eyebrow self-center">دعوة — عرض حيّ</span>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem,5vw,3.25rem)", color: "#f4ede0" }}>
            جرّبها بنفسك في دقيقة
          </h1>
          <p className="section-lede mx-auto" style={{ color: "rgba(244,237,224,0.78)" }}>
            هذا زفاف حقيقي على المنصّة — ليس عرضًا مصوّرًا. كل ما تضغطه هنا يتغيّر فعلًا.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {tiles.map((t, i) => (
            <div key={t.key} className="card card-lift p-5 flex flex-col items-center gap-3 text-center">
              <span className="step-num tnum" aria-hidden="true">{t.step}</span>
              <h2 className="title">{t.title}</h2>
              <p className="meta leading-relaxed">{t.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={codes[i]}
                alt=""
                width={210}
                height={210}
                style={{ borderRadius: "0.9rem", border: "1px solid var(--line-soft)", background: "#fff", padding: "0.4rem" }}
              />
              <a href={t.href} target="_blank" rel="noreferrer" className="pill-btn pill-btn-sm">
                أو افتحه من هنا
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="card p-5 flex flex-col gap-3 text-center">
            <h2 className="title">للزائر التالي</h2>
            <p className="meta leading-relaxed">
              يرجع الزفاف لحالته الأولى: ضيف المعرض لم يردّ بعد، ولا أحد دخل من الباب.
              الضيوف الآخرون وأرقامهم تبقى كما هي.
            </p>
            <DemoReset />
            <p className="hint" style={{ margin: 0 }}>
              {event.coupleNames} — {event.venueName} — رمز السكانر DEMO2026
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export { DEMO_EVENT_ID };
