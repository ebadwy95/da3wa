"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatEventDateArabic } from "@/lib/date";

export default function InvitePage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center">جاري التحميل...</main>}>
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [state, setState] = useState({ loading: true, error: null, guest: null, event: null });
  const [companions, setCompanions] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [wishText, setWishText] = useState("");
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishError, setWishError] = useState("");
  const [tab, setTab] = useState("invite"); // invite | wall
  const [wishes, setWishes] = useState([]);
  const [wishesLoading, setWishesLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/guests/${id}?t=${encodeURIComponent(token || "")}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطأ");
        return data;
      })
      .then(({ guest, event }) => {
        setState({ loading: false, error: null, guest, event });
        setCompanions(guest.confirmedCompanions || 0);
        setWishText(guest.wishMessage || "");
      })
      .catch((err) => setState({ loading: false, error: err.message, guest: null, event: null }));
  }, [id, token]);

  useEffect(() => {
    if (tab !== "wall" || !state.event) return;
    setWishesLoading(true);
    fetch(`/api/events/${state.event.id}/wishes?guestId=${id}&t=${encodeURIComponent(token || "")}`)
      .then((res) => res.json())
      .then((data) => setWishes(data.wishes || []))
      .finally(() => setWishesLoading(false));
  }, [tab, state.event, id, token]);

  async function respond(attending) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/guests/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, attending, companions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      setState((s) => ({ ...s, guest: data.guest }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendWish() {
    setWishSubmitting(true);
    setWishError("");
    try {
      const res = await fetch(`/api/guests/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: wishText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      setState((s) => ({ ...s, guest: data.guest }));
    } catch (err) {
      setWishError(err.message);
    } finally {
      setWishSubmitting(false);
    }
  }

  if (state.loading) {
    return <main className="min-h-screen flex items-center justify-center">جاري التحميل...</main>;
  }

  if (state.error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-sm w-full p-8 text-center">
          <p className="text-red-600 font-medium">{state.error}</p>
        </div>
      </main>
    );
  }

  const { guest, event } = state;
  const prettyDate = formatEventDateArabic(event.eventDate);

  return (
    <main className="min-h-screen flex flex-col items-center p-6 gap-4">
      <div className="tab-switch">
        <button data-active={tab === "invite"} onClick={() => setTab("invite")}>الدعوة</button>
        <button data-active={tab === "wall"} onClick={() => setTab("wall")}>رسائل التهنئة</button>
      </div>

      {tab === "invite" ? (
        <div className="card max-w-md w-full p-8 text-center space-y-5 da3wa-fade-in">
          <div className="ornament-divider text-xs tracking-widest">
            <span>✦</span>
          </div>
          <p className="text-sm font-display" style={{ color: "var(--gold-dark)", fontSize: "1.1rem" }}>
            بسم الله نبدأ فرحتنا، وبالحب نكتب أجمل بدايات العمر
          </p>
          <h1 className="font-display text-4xl leading-tight" style={{ color: "var(--ink)" }}>
            {event.coupleNames}
          </h1>
          {prettyDate && <p className="text-sm text-gray-500 tracking-wide">{prettyDate}</p>}

          <div className="ornament-divider text-xs tracking-widest">
            <span>✦</span>
          </div>

          <h2 className="text-xl font-bold" style={{ color: "var(--gold-dark)" }}>
            أهلًا {guest.name} 🌸
          </h2>
          <p className="text-gray-600 leading-relaxed text-sm">{event.welcomeMessage}</p>

          {(prettyDate || event.venueName) && (
            <div className="text-sm text-gray-500 border-t border-b py-3 space-y-1" style={{ borderColor: "#f1e8d8" }}>
              {prettyDate && <p>📅 {prettyDate}</p>}
              {event.venueName && <p>📍 {event.venueName}</p>}
              {event.venueMapUrl && (
                <a
                  href={event.venueMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-btn-outline inline-flex mt-2 text-xs"
                >
                  📍 اضغط لعرض الموقع
                </a>
              )}
            </div>
          )}

          {guest.status === "pending" && (
            <div className="space-y-4">
              {guest.maxCompanions > 0 && (
                <div>
                  <label className="block text-sm text-gray-500 mb-2">
                    عدد المرافقين معك (بحد أقصى {guest.maxCompanions})
                  </label>
                  <select
                    value={companions}
                    onChange={(e) => setCompanions(Number(e.target.value))}
                    className="border rounded-lg px-4 py-2"
                    style={{ borderColor: "#eee0cc" }}
                  >
                    {Array.from({ length: guest.maxCompanions + 1 }, (_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  disabled={submitting}
                  onClick={() => respond(true)}
                  className="pill-btn flex-1"
                >
                  أكد الحضور ✅
                </button>
                <button
                  disabled={submitting}
                  onClick={() => respond(false)}
                  className="pill-btn-outline flex-1"
                >
                  أعتذر
                </button>
              </div>
            </div>
          )}

          {guest.status === "confirmed" && (
            <div className="space-y-4">
              <p className="text-green-700 font-semibold">
                تم تأكيد حضورك{guest.confirmedCompanions ? ` مع ${guest.confirmedCompanions} من المرافقين` : ""} 🎉
              </p>
              {guest.qrDataUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={guest.qrDataUrl} alt="QR Code للدخول" className="mx-auto rounded-xl border" style={{ borderColor: "#eee0cc" }} />
                  <p className="text-xs text-gray-400">سيصلك الرمز نفسه على واتساب — أظهره للموظف يوم الزفاف</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">جارٍ تجهيز رمز الدخول...</p>
              )}
            </div>
          )}

          {guest.status === "declined" && (
            <p className="text-gray-500">تم تسجيل اعتذارك، نتمنى أن نراك في مناسبة أخرى 🌷</p>
          )}

          {guest.status !== "pending" && (
            <div className="text-right space-y-2 border-t pt-4" style={{ borderColor: "#f1e8d8" }}>
              <label className="block text-sm text-gray-500">
                {guest.wishMessage ? "تعديل رسالتك للعروسين" : "اترك رسالة تهنئة للعروسين 💌"}
              </label>
              <textarea
                value={wishText}
                onChange={(e) => setWishText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="اكتب هنا رسالتك أو تهنئتك..."
                className="w-full border rounded-lg px-3 py-2 outline-none text-sm"
                style={{ borderColor: "#eee0cc" }}
              />
              {wishError && <p className="text-red-600 text-xs">{wishError}</p>}
              <button
                onClick={sendWish}
                disabled={wishSubmitting || !wishText.trim()}
                className="pill-btn w-full"
              >
                {wishSubmitting ? "جارٍ الإرسال..." : guest.wishMessage ? "تحديث الرسالة" : "إرسال الرسالة"}
              </button>
              {guest.wishMessage && (
                <p className="text-xs text-green-700">تم إرسال رسالتك، ويمكنك تعديلها في أي وقت.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="wall-section max-w-md w-full p-5 da3wa-fade-in">
          <h2 className="font-display text-2xl text-center mb-4" style={{ color: "#e7d2a4" }}>
            رسائل التهنئة
          </h2>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {wishesLoading && <p className="text-center text-sm opacity-60 py-6">جارٍ التحميل...</p>}
            {!wishesLoading && wishes.length === 0 && (
              <p className="text-center text-sm opacity-60 py-6">لم تصل رسائل تهنئة بعد — كن أول من يهنّئ العروسين</p>
            )}
            {wishes.map((w, i) => (
              <div key={i} className="wish-card p-3 flex items-start gap-3">
                <span className="avatar-circle text-sm">{w.name?.trim()?.[0] || "؟"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#e7d2a4" }}>{w.name}</p>
                  <p className="text-sm leading-relaxed mt-0.5">{w.wishMessage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
