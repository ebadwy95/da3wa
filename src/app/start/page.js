"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { EVENT_TYPES } from "@/lib/eventTypes";
import { StarOrnamentIcon, CheckCircleIcon, AlertIcon, SendIcon } from "@/components/icons";

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  eventType: "",
  eventDate: "",
  guestCount: "",
  notes: "",
};

export default function StartPage() {
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر إرسال الطلب");
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <header className="site-header">
        <div className="wrap flex items-center justify-between gap-4" style={{ padding: "0.7rem 1.25rem" }}>
          <Link href="/" style={{ color: "var(--gold-300)" }}>
            <Logo size={34} />
          </Link>
          <Link href="/" className="pill-btn-ghost pill-btn-sm" style={{ color: "rgba(244,237,224,0.7)" }}>
            رجوع
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="wrap" style={{ maxWidth: "42rem" }}>
          {done ? (
            <div className="card-ornate p-10 text-center flex flex-col items-center gap-4 da3wa-fade-in">
              <span style={{ color: "var(--ok)" }}>
                <CheckCircleIcon size={44} />
              </span>
              <h1 className="section-title">وصلنا طلبك</h1>
              <p className="section-lede" style={{ textAlign: "center" }}>
                سنتواصل معك على الرقم الذي تركته خلال يوم عمل واحد لنتفق على
                التفاصيل ونجهّز دعوتك.
              </p>
              <Link href="/" className="pill-btn mt-2">
                العودة للصفحة الرئيسية
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-8 text-center">
                <div className="ornament-divider" aria-hidden="true">
                  <StarOrnamentIcon size={14} />
                </div>
                <h1 className="section-title">احكِ لنا عن مناسبتك</h1>
                <p className="section-lede" style={{ marginInline: "auto", textAlign: "center" }}>
                  املأ ما تعرفه الآن — ولا بأس بما لم تقرّره بعد. نتواصل معك
                  ونكمل الباقي معًا.
                </p>
              </div>

              <form onSubmit={submit} className="card p-6 sm:p-8 flex flex-col gap-5">
                <fieldset className="flex flex-col gap-2 m-0 p-0 border-0">
                  <legend className="label p-0">نوع المناسبة</legend>
                  {/* Radio cards rather than a dropdown: showing the full range
                      is the point — a visitor who assumes this is weddings-only
                      never opens the menu to find out otherwise. */}
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
                  >
                    {EVENT_TYPES.map((t) => (
                      <label
                        key={t.id}
                        className="type-chip"
                        data-selected={form.eventType === t.id}
                      >
                        <input
                          type="radio"
                          name="eventType"
                          value={t.id}
                          checked={form.eventType === t.id}
                          onChange={set("eventType")}
                          className="sr-only"
                        />
                        {t.ar}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  <div>
                    <label htmlFor="name" className="label">الاسم</label>
                    <input id="name" value={form.name} onChange={set("name")} required className="field" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="label">رقم الواتساب (مع رمز الدولة)</label>
                    <input
                      id="phone"
                      value={form.phone}
                      onChange={set("phone")}
                      required
                      dir="ltr"
                      placeholder="+965XXXXXXXX"
                      className="field"
                    />
                  </div>
                </div>

                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  <div>
                    <label htmlFor="eventDate" className="label">تاريخ المناسبة (إن تحدّد)</label>
                    <input id="eventDate" type="date" value={form.eventDate} onChange={set("eventDate")} className="field" />
                  </div>
                  <div>
                    <label htmlFor="guestCount" className="label">عدد الضيوف تقريبًا</label>
                    <input
                      id="guestCount"
                      type="number"
                      min={1}
                      value={form.guestCount}
                      onChange={set("guestCount")}
                      placeholder="150"
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="label">البريد الإلكتروني (اختياري)</label>
                  <input id="email" type="email" value={form.email} onChange={set("email")} dir="ltr" className="field" />
                </div>

                <div>
                  <label htmlFor="notes" className="label">احكِ لنا عن مناسبتك</label>
                  <textarea
                    id="notes"
                    value={form.notes}
                    onChange={set("notes")}
                    rows={5}
                    maxLength={1500}
                    placeholder="المكان، الطابع الذي تتخيله، هل تحتاج فيديو دعوة، أي شيء يهمك أن نعرفه..."
                    className="field"
                    style={{ resize: "vertical" }}
                  />
                  <p className="hint tnum ltr text-left">{form.notes.length} / 1500</p>
                </div>

                {error && (
                  <p className="error flex items-center gap-2" role="alert">
                    <AlertIcon size={16} />
                    {error}
                  </p>
                )}

                <button disabled={sending} className="pill-btn w-full">
                  <SendIcon size={18} />
                  {sending ? "جارٍ الإرسال..." : "أرسل الطلب"}
                </button>

                <p className="hint text-center m-0">
                  أو راسلنا مباشرة على{" "}
                  <a href="mailto:hello@da3wa.digital" className="ltr" style={{ color: "var(--gold-600)" }}>
                    hello@da3wa.digital
                  </a>
                </p>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
