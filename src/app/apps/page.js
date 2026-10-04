import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";

// Every Da3wa app in one place: who each one is for, what it does, and a
// link that opens it — from where it installs on the phone as its own app.
// Written in Gulf Arabic, like everything people outside the team read.
export const metadata = { ...PRIVATE_ROUTE_METADATA, title: "تطبيقات دعوة" };

const APPS = [
  {
    name: "لوحة الإدارة",
    icon: "/icons/admin-192.png",
    who: "لك أنت — مسؤول المنصة",
    what: "تدير كل الأعراس: الضيوف، الرسائل، الكروت، دخول العرسان، فريق الأمن، وتطبيق الإرسال.",
    href: "/admin",
  },
  {
    name: "لوحة العروسين",
    icon: "/icons/couple-192.png",
    who: "للعريس والعروس",
    what: "يتابعون ضيوفهم: مين أكد ومين اعتذر، عدد الحضور، ومين دخل القاعة يوم العرس.",
    href: "/couple",
  },
  {
    name: "إرسال الدعوات",
    icon: "/icons/send-192.png",
    who: "للعريس والعروس — كل واحد بحسابه",
    what: "يرسلون من واتسابهم الدعوة، ثم بطاقة الدخول، ثم التذكير، ثم الشكر — ضغطتين لكل ضيف.",
    href: "/send",
  },
  {
    name: "سكانر الباب",
    icon: "/icons/scan-192.png",
    who: "لموظفي الأمن عند البوابة",
    what: "يمسح بطاقات الدخول، يرن لو الباركود مستخدم، وفيه زر طوارئ SOS يستدعي فريق الأمن.",
    href: "/scan",
  },
  {
    name: "تنبيهات الأمن",
    icon: "/icons/guard-192.png",
    who: "لفريق الأمن اللي يستقبل النداءات",
    what: "يرن على تلفونهم لما موظف الباب يضغط SOS أو يجي أحد بباركود مستخدم.",
    note: "ما له رابط عام — كل واحد يوصله رابطه الخاص من لوحة الإدارة ← فريق الأمن.",
  },
];

export default function AppsPage() {
  return (
    <main className="min-h-screen p-5" style={{ background: "var(--paper)" }} dir="rtl">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <header className="text-center flex flex-col gap-2 pt-4">
          <h1 className="title-lg" style={{ color: "var(--gold-600)" }}>تطبيقات دعوة</h1>
          <p className="meta leading-relaxed">
            كل تطبيق ينزل على التلفون لحاله بأيقونته. افتح التطبيق اللي تبيه، وبيطلع لك زر «ثبّت على الشاشة».
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {APPS.map((app) => {
            const body = (
              <>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={app.icon} alt="" width={56} height={56} style={{ borderRadius: 14, flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p className="font-bold" style={{ fontSize: "var(--text-lg)" }}>{app.name}</p>
                    <p className="text-xs" style={{ color: "var(--gold-600)", fontWeight: 600 }}>{app.who}</p>
                  </div>
                </div>
                <p className="text-sm text-ink-2 leading-relaxed">{app.what}</p>
                {app.href ? (
                  <span className="pill-btn pill-btn-sm self-start">افتح التطبيق</span>
                ) : (
                  <p className="text-xs text-ink-3 leading-relaxed">{app.note}</p>
                )}
              </>
            );
            return app.href ? (
              <a key={app.name} href={app.href} className="card p-4 flex flex-col gap-3" style={{ textDecoration: "none", color: "inherit" }}>
                {body}
              </a>
            ) : (
              <div key={app.name} className="card p-4 flex flex-col gap-3">
                {body}
              </div>
            );
          })}
        </div>

        <section className="card-flat p-4 flex flex-col gap-2 text-sm leading-relaxed">
          <p className="font-bold">طريقة التثبيت</p>
          <p>
            <b>آيفون:</b> افتح التطبيق من Safari ← زر المشاركة (المربع اللي طالع منه سهم) ← «إضافة إلى الشاشة
            الرئيسية» ← «إضافة».
          </p>
          <p>
            <b>أندرويد:</b> افتح التطبيق من Chrome ← اضغط زر «ثبّت» اللي يطلع لك، أو النقاط الثلاث ⋮ ← «تثبيت
            التطبيق».
          </p>
        </section>
      </div>
    </main>
  );
}
