import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarOrnamentIcon, PhoneIcon, MessageIcon } from "@/components/icons";
import { EnvelopeOpener } from "@/components/EnvelopeOpener";

// The partner page — pricing a planner may see, and nobody else.
//
// The secret is the URL itself: the token in the path is checked against
// PARTNER_ACCESS_TOKEN, and a wrong one 404s rather than 403s so the response
// never confirms that a partner page exists at all. That is deliberate — a
// 403 tells a crawler where to keep knocking.
//
// This is a shared link, not an account. Anyone Eslam sends it to can forward
// it, and the only revocation is rotating the env var, which invalidates every
// outstanding link at once. That trade is right for the audience — a planner
// gets one click, not a login — but it is a trade, and it is why the page
// carries a discretion line rather than pretending to be secure.
export const dynamic = "force-dynamic";

const TIERS = [
  { name: "أساسية", guests: "لين ٢٠٠ معزوم", price: "٨٠" },
  { name: "المميزة", guests: "لين ٣٥٠ معزوم", price: "١٣٠", feature: true },
  { name: "الكبرى", guests: "لين ٧٠٠ معزوم", price: "٢٢٠" },
];

const PAINS = [
  "تلاحقون التأكيدات بالتلفون والواتساب، اسم اسم",
  "ترسلون رقم لشركة البوفيه، وانتم مو متأكدين منه",
  "ليلة العرس تكونون على الباب بدل ما تكونون تنظّمون",
  "وأي شي يصير، انتم المسؤولين — حتى لو مو شغلكم",
];

const STEPS = [
  ["الدعوة توصل باسم كل معزوم", "على واتساب، لكل واحد باسمه — مو رابط عام ينتشر."],
  ["المعزوم يأكّد ويقول كم واحد معه", "الرقم اللي تعطونه للبوفيه وللصالة يكون رقم حقيقي، مو تقدير."],
  ["يوصله رمز خاص فيه", "على جواله. ما يحتاج يطبع ولا يحفظ شي."],
  ["موظف من عندنا على الباب", "يدخل المعزوم في ثانية — وانتم فاضين تنظّمون."],
  ["وبعد الليلة", "كل معزوم يترك كلمة، وانتم تستلمون تقرير كامل بالحضور."],
];

const GAINS = [
  ["خدمة إضافية في عرضكم", "تبيعونها بالسعر اللي تشوفونه مناسب"],
  ["جواب جاهز للعميل", "«كم أكّد؟» يصير رقم على الشاشة، مو تخمين"],
  ["ما تلاحقون أحد", "التأكيدات والتذكيرات تمشي لحالها"],
  ["باسمكم إذا تبون", "الدعوة ولوحة المتابعة بهويتكم"],
];

export default async function PartnersPage({ params }) {
  const { token } = await params;
  const expected = process.env.PARTNER_ACCESS_TOKEN;

  // No token configured means the page is off, not open to everyone.
  if (!expected || token !== expected) notFound();

  return (
    <EnvelopeOpener audioUrl="/samples/partners.mp3">
    <main className="min-h-screen invite-dark" style={{ background: "var(--paper)" }}>
      <header className="wrap flex items-center justify-between py-6 px-5">
        <Link href="/" aria-label="دعوة" style={{ color: "var(--gold-300)" }}>
          <Logo size={36} showLatin />
        </Link>
        <span className="chip chip-gold">للشركاء</span>
      </header>

      <section className="wrap px-5 pt-8 pb-16 text-center">
        <div className="ornament-divider" aria-hidden="true">
          <StarOrnamentIcon size={14} />
        </div>
        <p className="hero-eyebrow">شراكة دعوة</p>
        <h1 className="font-display" style={{ fontSize: "clamp(2.4rem, 7vw, 4rem)", lineHeight: 1.4, color: "var(--gold-600)" }}>
          «كم واحد أكّد؟»
          <br />
          وما عندكم جواب
        </h1>
        <p className="body" style={{ maxWidth: "34ch", margin: "1.4rem auto 0" }}>
          العميل يسألكم كل يوم. وانتم تفتحون الإكسل، وتتصلون، وترسلون واتساب واحد
          واحد — وبعد كل هذا الرقم يبقى تقريبي.
        </p>
      </section>

      <section className="band-dark" style={{ padding: "3.5rem 1.25rem" }}>
        <div className="wrap" style={{ maxWidth: "46rem" }}>
          <p className="eyebrow">المشكلة</p>
          <ul className="flex flex-col gap-4 mt-4">
            {PAINS.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span style={{ color: "var(--gold-400)", marginTop: 4 }}><StarOrnamentIcon size={14} /></span>
                <span className="body">{t}</span>
              </li>
            ))}
          </ul>
          <p className="meta mt-6" style={{ borderInlineStart: "2px solid var(--gold-500)", paddingInlineStart: "1rem", lineHeight: 1.9 }}>
            انتم مو مسؤولين عن الأكل ولا عن الصالة. بس الرقم اللي تعطونه للبوفيه،
            والباب اللي يستقبل المعازيم — هذا شغلكم، وعليه يتحاسبون معكم.
          </p>
        </div>
      </section>

      <section className="wrap px-5 py-16" style={{ maxWidth: "46rem" }}>
        <p className="eyebrow">الحل</p>
        <h2 className="font-display" style={{ fontSize: "2rem", color: "var(--gold-600)", margin: ".5rem 0 2rem" }}>
          نظام كامل، مو تصميم دعوة
        </h2>
        <ol className="flex flex-col gap-6">
          {STEPS.map(([title, detail], i) => (
            <li key={title} className="flex gap-4 items-start">
              <span
                className="tnum flex items-center justify-center flex-none font-display"
                style={{
                  width: 42, height: 42, borderRadius: "50%",
                  border: "1.5px solid var(--gold-500)", color: "var(--gold-600)",
                }}
              >
                {["١", "٢", "٣", "٤", "٥"][i]}
              </span>
              <span>
                <strong className="block" style={{ fontSize: "var(--text-lg)" }}>{title}</strong>
                <span className="meta">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="band-dark" style={{ padding: "3.5rem 1.25rem" }}>
        <div className="wrap" style={{ maxWidth: "46rem" }}>
          <p className="eyebrow">وش تكسبون</p>
          <div className="grid md:grid-cols-2 gap-5 mt-5">
            {GAINS.map(([title, detail]) => (
              <div key={title} className="feature-card">
                <strong className="block mb-1">{title}</strong>
                <span className="meta">{detail}</span>
              </div>
            ))}
          </div>
          <p className="body mt-7">
            <strong>وما نتواصل مع عميلكم من ورا ظهركم.</strong> العلاقة معكم،
            والعميل يبقى عميلكم.
          </p>
        </div>
      </section>

      <section className="wrap px-5 py-16" style={{ maxWidth: "46rem" }}>
        <p className="eyebrow">أسعار الشركاء</p>
        <h2 className="font-display" style={{ fontSize: "2rem", color: "var(--gold-600)", margin: ".5rem 0 .4rem" }}>
          سعر للعرس، مو حساب على كل معزوم
        </h2>
        <p className="meta mb-7">
          هذا سعركم انتم. بيعوها بالرقم اللي تشوفونه مناسب لعميلكم — الفرق كله لكم.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div key={t.name} className={t.feature ? "card-ornate p-6 text-center" : "card p-6 text-center"}>
              <p style={{ color: "var(--gold-600)", fontWeight: 500 }}>{t.name}</p>
              <p className="font-display tnum" style={{ fontSize: "2.6rem", lineHeight: 1.3 }}>{t.price}</p>
              <p className="meta">د.ك</p>
              <p className="meta pt-3 mt-3" style={{ borderTop: "1px solid var(--line-soft)" }}>{t.guests}</p>
            </div>
          ))}
        </div>

        <p className="meta mt-6" style={{ borderInlineStart: "2px solid var(--gold-500)", paddingInlineStart: "1rem", lineHeight: 1.9 }}>
          سعر الشريك يبدأ من <strong>٥ مناسبات</strong> في السنة، وفوق <strong>١٢</strong> نراجعه لصالحكم.
          <br />
          كل باقة شاملة: الدعوة بتصميمكم · الإرسال لكل معزوم باسمه · تأكيد الحضور ·
          موظف على الباب · كلمات المعازيم · لوحة متابعة · تقرير بعد المناسبة.
        </p>
      </section>

      <section className="band-dark" style={{ padding: "4rem 1.25rem" }}>
        <div className="wrap text-center" style={{ maxWidth: "34rem" }}>
          <div className="ornament-divider" aria-hidden="true">
            <StarOrnamentIcon size={14} />
          </div>
          <h2 className="font-display" style={{ fontSize: "2.2rem", color: "var(--gold-300)" }}>
            نجرّب مناسبة وحدة؟
          </h2>
          <p className="body mt-3">
            أول مناسبة معكم نمشّيها خطوة بخطوة، وانتم تشوفون النتيجة قبل ما تلتزمون بأي شي.
          </p>

          <div className="flex flex-col gap-3 items-center mt-8">
            {[
              ["الكويت", "+965 6161 5767", "96561615767"],
              ["السعودية", "+966 53 097 7565", "966530977565"],
            ].map(([label, display, digits]) => (
              <div key={digits} className="flex items-center gap-2 flex-wrap justify-center">
                <span className="meta" style={{ minWidth: "4.5rem", textAlign: "start" }}>{label}</span>
                <a href={`tel:+${digits}`} className="pill-btn-outline pill-btn-sm ltr" dir="ltr">
                  <PhoneIcon size={15} />
                  {display}
                </a>
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-btn-outline pill-btn-sm"
                >
                  <MessageIcon size={15} />
                  واتساب
                </a>
              </div>
            ))}
          </div>

          <p className="hint mt-8">
            هذي الصفحة وأسعارها للشركاء فقط — نرجو عدم مشاركتها.
          </p>
        </div>
      </section>
    </main>
    </EnvelopeOpener>
  );
}
