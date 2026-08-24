import Link from "next/link";
import { RingsIcon, StarOrnamentIcon, QrIcon, SendIcon, UsersIcon } from "@/components/icons";

const FEATURES = [
  { Icon: SendIcon, text: "رابط دعوة شخصي لكل ضيف على واتساب" },
  { Icon: UsersIcon, text: "تأكيد حضور بعدد مرافقين محدَّد" },
  { Icon: QrIcon, text: "رمز QR للدخول وماسح على الباب" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card-ornate max-w-md w-full p-8 text-center flex flex-col gap-6 da3wa-fade-in">
        <div className="flex flex-col items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-14 h-14 rounded-full"
            style={{ background: "var(--gold-50)", color: "var(--gold-600)" }}
          >
            <RingsIcon size={28} />
          </span>
          <h1 className="font-display text-3xl" style={{ color: "var(--gold-600)" }}>
            Da3wa
          </h1>
        </div>

        <div className="ornament-divider" aria-hidden="true">
          <StarOrnamentIcon size={14} />
        </div>

        <p className="body">
          نظام دعوات أفراح إلكتروني — لكل ضيف رابط شخصي، تأكيد حضور، ورمز دخول
          يوم الزفاف.
        </p>

        <ul className="flex flex-col gap-2.5 text-right">
          {FEATURES.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span style={{ color: "var(--gold-500)" }}>
                <Icon size={18} />
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>{text}</span>
            </li>
          ))}
        </ul>

        <Link href="/admin" className="pill-btn w-full">
          دخول لوحة الإدارة
        </Link>
      </div>
    </main>
  );
}
