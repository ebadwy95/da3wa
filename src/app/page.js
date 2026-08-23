import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <h1 className="text-3xl font-bold" style={{ color: "var(--gold-dark)" }}>
          Da3wa
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          نظام دعوات أفراح إلكتروني — لكل ضيف رابط شخصي، تأكيد حضور، وQR للدخول
          يوم الزفاف.
        </p>
        <Link
          href="/admin"
          className="pill-btn w-full"
        >
          دخول لوحة الإدارة
        </Link>
      </div>
    </main>
  );
}
