"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
      })
      .catch((err) => setState({ loading: false, error: err.message, guest: null, event: null }));
  }, [id, token]);

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

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center space-y-5">
        <h1 className="text-lg text-gray-500">{event.coupleNames}</h1>
        <h2 className="text-2xl font-bold" style={{ color: "var(--gold-dark)" }}>
          أهلاً {guest.name} 🌸
        </h2>
        <p className="text-gray-600 leading-relaxed text-sm">{event.welcomeMessage}</p>

        {(event.eventDate || event.venueName) && (
          <div className="text-sm text-gray-500 border-t border-b py-3" style={{ borderColor: "#f1e8d8" }}>
            {event.eventDate && <p>📅 {event.eventDate}</p>}
            {event.venueName && <p>📍 {event.venueName}</p>}
          </div>
        )}

        {guest.status === "pending" && (
          <div className="space-y-4">
            {guest.maxCompanions > 0 && (
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  عدد المرافقين معاك (بحد أقصى {guest.maxCompanions})
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
                className="btn-gold flex-1 py-3 rounded-xl font-semibold"
              >
                أكد الحضور ✅
              </button>
              <button
                disabled={submitting}
                onClick={() => respond(false)}
                className="flex-1 py-3 rounded-xl font-semibold border text-gray-600"
                style={{ borderColor: "#eee0cc" }}
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
                <p className="text-xs text-gray-400">هيوصلك نفس الكود ده على واتساب — وريه للموظف يوم الزفاف</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">جاري تجهيز كود الدخول...</p>
            )}
          </div>
        )}

        {guest.status === "declined" && (
          <p className="text-gray-500">تم تسجيل اعتذارك، نتمنى نشوفك في مناسبة تانية 🌷</p>
        )}
      </div>
    </main>
  );
}
