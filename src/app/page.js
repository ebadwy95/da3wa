import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Logo } from "@/components/Logo";
import {
  RingsIcon,
  StarOrnamentIcon,
  QrIcon,
  SendIcon,
  UsersIcon,
  UploadIcon,
  CheckCircleIcon,
  ShieldIcon,
  ScanIcon,
  HeartIcon,
  ClockIcon,
  MessageIcon,
} from "@/components/icons";

export const metadata = {
  title: "دعوات إلكترونية لمناسباتك",
  description:
    "رابط دعوة شخصي لكل ضيف على واتساب، تأكيد حضور بعدد المرافقين، ورمز دخول يُمسح على الباب — من لوحة واحدة.",
};

const STEPS = [
  {
    title: "ارفع قائمة ضيوفك",
    body: "ملف واحد بالأسماء والأرقام وعدد المسموح لكل دعوة. أو أضِف ضيفًا ضيفًا لو القائمة صغيرة.",
  },
  {
    title: "أرسل الدعوات",
    body: "ضغطة واحدة تبعت لكل ضيف رسالة واتساب فيها رابطه الشخصي هو وحده. الضيوف اللي تضيفهم بعدين يستقبلون دعوتهم بنفس الضغطة.",
  },
  {
    title: "الضيف يؤكد ويستلم رمزه",
    body: "يفتح رابطه، يختار عدد مرافقيه في حدود ما سمحت له به، ويظهر رمز دخوله فورًا — ويصله على واتساب كذلك.",
  },
  {
    title: "امسح على الباب",
    body: "موظف الاستقبال يمسح الرمز فيرى اسم الضيف وكم فردًا يسمح له بإدخالهم، ويؤكد العدد الداخل فعلًا.",
  },
];

const DOOR = [
  {
    Icon: CheckCircleIcon,
    title: "لا أحد يدخل بالخطأ",
    body: "قراءة الرمز تعرض الاسم والعدد المسموح فقط. لا يُحتسب دخول إلا بعد أن يؤكّد موظف الاستقبال كم فردًا يدخل فعلًا — فلا يضيع مقعد على أحد، ولا يدخل أحد مرتين.",
  },
  {
    Icon: ShieldIcon,
    title: "تعرف من استقبل من",
    body: "كل موظف له رمزه المرتبط باسمه مسبقًا، وكل عملية دخول تُسجَّل بمن قام بها. فإن سألت بعد الليلة عن أي اسم، الإجابة موجودة.",
  },
  {
    Icon: ScanIcon,
    title: "مناسبتك وحدها",
    body: "بيانات كل مناسبة معزولة تمامًا عن غيرها. ماسح مناسبتك لا يرى ولا يُدخل ضيوف أحد آخر — حتى لو أُقيمت مناسبتان في الليلة نفسها.",
  },
];

const COUPLE = [
  { Icon: UsersIcon, title: "تعرف عددك قبل الليلة", body: "من أكّد، من اعتذر، ومن لم يردّ بعد — ومجموع الحضور المتوقّع لحظة بلحظة." },
  { Icon: ClockIcon, title: "ومن دخل فعلًا أثناءها", body: "عدّاد يتحرك مع كل مسح على الباب، فتعرف من وصل ومن ما زال في الطريق." },
  { Icon: MessageIcon, title: "وتهانيهم في مكان واحد", body: "كل ضيف يترك رسالته من صفحة دعوته، وتتجمّع لكما في حائط واحد يبقى بعد الليلة." },
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <div className="wrap flex items-center justify-between gap-4" style={{ padding: "0.7rem 1.25rem" }}>
          <span style={{ color: "var(--gold-300)" }}>
            <Logo size={34} animated />
          </span>
          <div className="flex items-center gap-2">
            <Link href="/start" className="pill-btn pill-btn-sm">
              اطلب مناسبتك
            </Link>
            <Link href="/admin" className="pill-btn-ghost pill-btn-sm" style={{ color: "rgba(244,237,224,0.7)" }}>
              دخول
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      <section className="band-dark section" style={{ paddingBlock: "clamp(3.5rem, 9vw, 6rem)" }}>
        <div className="hero-glow" aria-hidden="true" />
        <div className="pattern-veil" aria-hidden="true" />

        <div
          className="wrap relative grid gap-12 items-center"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
        >
          <div className="flex flex-col gap-6 text-center lg:text-right">
            <Reveal className="flex justify-center lg:justify-start">
              <span className="hero-eyebrow">
                <StarOrnamentIcon size={13} />
                دعوات إلكترونية للمناسبات
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1
                className="font-display"
                style={{ fontSize: "clamp(2.5rem, 7vw, 4rem)", lineHeight: 1.35, color: "#f7ecd8" }}
              >
                دعوة تليق بليلة العمر
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p
                className="section-lede mx-auto lg:mx-0"
                style={{ color: "rgba(244,237,224,0.78)" }}
              >
                رابط شخصي لكل ضيف على واتساب، تأكيد حضور بعدد المرافقين، ورمز دخول
                يُمسح على الباب. كل ذلك من لوحة واحدة — بلا أوراق ولا مكالمات.
              </p>
            </Reveal>

            <Reveal delay={240} className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link href="/start" className="pill-btn">
                <RingsIcon size={18} />
                ابدأ الآن
              </Link>
              <a href="#how" className="pill-btn-outline" style={{ color: "#ecd9ae", borderColor: "rgba(224,196,141,0.45)" }}>
                كيف يعمل؟
              </a>
            </Reveal>
          </div>

          {/* The film is the product's own output, playing as itself — the
              most honest thing this page can show. Muted and looping so it
              can autoplay; the invitation is where it plays with sound. */}
          <Reveal delay={300} className="flex justify-center">
            <div className="phone">
              <div className="phone-screen">
                <video
                  src="/samples/invite.mp4"
                  poster="/samples/poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label="نموذج لدعوة إلكترونية"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section id="how" className="section">
        <div className="wrap flex flex-col gap-10">
          <Reveal className="flex flex-col gap-3">
            <h2 className="section-title">من قائمة أسماء إلى ليلة منظّمة</h2>
            <p className="section-lede">أربع خطوات، تبدأ قبل الزفاف بأسابيع وتنتهي عند بابه.</p>
          </Reveal>

          <ol className="flex flex-col gap-8">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 70} className="step">
                <span className="step-num tnum" aria-hidden="true">{i + 1}</span>
                <h3 className="title" style={{ marginBottom: "0.3rem" }}>{s.title}</h3>
                <p className="body">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="band-dark section">
        <div className="pattern-veil" aria-hidden="true" />
        <div className="wrap relative flex flex-col gap-10">
          <Reveal className="flex flex-col gap-3">
            <span className="hero-eyebrow self-start">
              <QrIcon size={13} />
              الاستقبال
            </span>
            <h2 className="section-title">الاستقبال؟ خليها علينا</h2>
            <p className="section-lede">
              أنتم مشغولون بليلتكم، لا بمن وصل ومن ما زال في الطريق. نحن نتكفّل
              بالباب: كل ضيف يدخل باسمه وفي وقته، بلا قوائم ورقية ولا انتظار.
            </p>
          </Reveal>

          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {DOOR.map(({ Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="feature-card">
                  <span className="feature-icon"><Icon size={22} /></span>
                  <h3 className="title">{title}</h3>
                  <p style={{ color: "rgba(244,237,224,0.72)", fontSize: "var(--text-sm)" }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="section" style={{ background: "var(--sunken)" }}>
        <div className="wrap flex flex-col gap-10">
          <Reveal className="flex flex-col gap-3">
            <h2 className="section-title">وللعروسين لوحتهما الخاصة</h2>
            <p className="section-lede">
              بحساب مستقل يريان فيها مناسبتهما وحدها — لا يحتاجان إلى أحد ليسألاه كم
              شخصًا أكّد.
            </p>
          </Reveal>

          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {COUPLE.map(({ Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="feature-card">
                  <span className="feature-icon"><Icon size={22} /></span>
                  <h3 className="title">{title}</h3>
                  <p className="body" style={{ fontSize: "var(--text-sm)" }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="section">
        <div className="wrap">
          <Reveal>
            <div className="card-ornate p-10 text-center flex flex-col items-center gap-5">
              <div className="ornament-divider w-full max-w-xs" aria-hidden="true">
                <StarOrnamentIcon size={16} />
              </div>
              <h2 className="font-display" style={{ fontSize: "clamp(1.9rem, 5vw, 2.75rem)", color: "var(--gold-600)" }}>
                ليلتكم تستاهل
              </h2>
              <p className="section-lede" style={{ textAlign: "center" }}>
                جهّز دعوتك، وارفع قائمة ضيوفك، وسلّم الباب لنظام يعرف كل اسم.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/start" className="pill-btn">
                  <SendIcon size={18} />
                  ابدأ الآن
                </Link>
                <a
                  href="https://wa.me/96561615767?text=%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D8%AF%D8%B9%D9%88%D8%A7%D8%AA%20%D8%AF%D8%B9%D9%88%D8%A9"
                  target="_blank"
                  rel="noreferrer"
                  className="pill-btn-outline"
                >
                  تواصل معنا
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The legal entity block is not decoration. Meta's business
          verification crawls this domain looking for the registered legal
          name and rejects the portfolio when it can't find it — the brand
          name alone ("Da3wa") is what the earlier attempt failed on. The
          Arabic form is the one that has to match: it is the name on the
          commercial register and in the Meta form. The English line sits
          beside it for readers, not for the crawler. */}
      <footer className="band-dark" style={{ padding: "2.5rem 1.25rem", textAlign: "center" }}>
        <div className="wrap flex flex-col items-center gap-3">
          <span style={{ color: "var(--gold-300)" }}>
            <Logo size={38} showLatin />
          </span>
          <p style={{ fontSize: "var(--text-xs)", color: "rgba(244,237,224,0.5)" }}>
            دعوات إلكترونية للمناسبات · hello@da3wa.digital
          </p>

          <address
            style={{
              fontStyle: "normal",
              fontSize: "var(--text-xs)",
              lineHeight: 1.9,
              color: "rgba(244,237,224,0.42)",
              maxWidth: "34rem",
            }}
          >
            <span style={{ display: "block" }}>
              دعوة علامة تجارية مملوكة لشركة{" "}
              <strong style={{ fontWeight: 600 }}>فيرتكس سكاي ش ذ م م</strong>
            </span>
            <span style={{ display: "block" }} dir="ltr">
              Da3wa is a brand of Vertex Sky LLC
            </span>
            <span style={{ display: "block" }}>
              ٣٩٨ طريق الحرية، برج الفنار، الدور العاشر، مكتب H5 — مصطفى كامل، سيدي جابر، الإسكندرية ٢١٥٢٣، مصر
            </span>
            <span style={{ display: "block" }} dir="ltr">
              398 Tareeq El Horreya, Fanar Tower, Floor 10, Office H5, Alexandria 21523, Egypt
            </span>
            <span style={{ display: "block" }} dir="ltr">
              <a href="tel:+201555229877">+20 155 522 9877</a>
              {" · "}
              <a href="mailto:hello@da3wa.digital">hello@da3wa.digital</a>
            </span>
          </address>

          <p style={{ fontSize: "var(--text-xs)", color: "rgba(244,237,224,0.35)" }}>
            © {new Date().getFullYear()} فيرتكس سكاي ش ذ م م — جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </main>
  );
}
