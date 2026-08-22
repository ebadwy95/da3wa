"use client";

import { useEffect, useRef, useState } from "react";

const READER_ID = "da3wa-qr-reader";

function LoginGate({ onLoggedIn }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [password, setPassword] = useState("");

  async function submitCode(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/scan-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "الكود غير صحيح");
      return;
    }
    onLoggedIn(data.event);
  }

  async function submitAdmin(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setError("كلمة المرور غير صحيحة");
      return;
    }
    onLoggedIn(null);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-sm w-full p-8 space-y-4 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--gold-dark)" }}>
          دخول سكانر الباب
        </h1>

        {!showAdmin ? (
          <form onSubmit={submitCode} className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              أدخل كود الزفاف الخاص بهذا الباب — كل زفاف له كود مختلف، حتى لو
              كان فيه أكتر من زفاف في نفس اليوم، كل سكانر هيشتغل بضيوف زفافه
              هو بس.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="كود الزفاف"
              dir="ltr"
              className="w-full border rounded-lg px-4 py-3 text-center outline-none tracking-widest font-mono"
              style={{ borderColor: "#eee0cc" }}
              autoFocus
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="btn-gold w-full py-3 rounded-lg font-semibold">دخول</button>
            <button
              type="button"
              onClick={() => { setShowAdmin(true); setError(""); }}
              className="text-xs text-gray-400 underline"
            >
              دخول كمسؤول المنصة (لكل الأفراح)
            </button>
          </form>
        ) : (
          <form onSubmit={submitAdmin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة مرور المنصة"
              className="w-full border rounded-lg px-4 py-3 text-center outline-none"
              style={{ borderColor: "#eee0cc" }}
              autoFocus
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="btn-gold w-full py-3 rounded-lg font-semibold">دخول</button>
            <button
              type="button"
              onClick={() => { setShowAdmin(false); setError(""); }}
              className="text-xs text-gray-400 underline"
            >
              الرجوع لتسجيل الدخول بكود الزفاف
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ScanPage() {
  const [authed, setAuthed] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState(null);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ code: null, at: 0 });

  useEffect(() => {
    fetch("/api/scan-auth").then(async (res) => {
      const data = await res.json().catch(() => ({}));
      setAuthed(Boolean(data.authed));
      setEventInfo(data.event || null);
    });
  }, []);

  async function submitCode(code) {
    // Debounce duplicate scans of the same code within 3s.
    const now = Date.now();
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < 3000) {
      return;
    }
    lastScanRef.current = { code, at: now };

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setResult({ ok: data.ok, message: data.message });
    } catch {
      setResult({ ok: false, message: "خطأ في الاتصال بالسيرفر" });
    }
  }

  useEffect(() => {
    if (authed !== true) return;

    let cancelled = false;
    let html5QrCode;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      html5QrCode = new Html5Qrcode(READER_ID);
      scannerRef.current = html5QrCode;

      Html5Qrcode.getCameras()
        .then((cameras) => {
          if (cancelled || !cameras?.length) {
            setCameraError("مفيش كاميرا متاحة — استخدم الإدخال اليدوي تحت");
            return;
          }
          const cameraId = cameras.find((c) => /back|rear/i.test(c.label))?.id || cameras[0].id;
          html5QrCode
            .start(
              cameraId,
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText) => submitCode(decodedText)
            )
            .catch(() => setCameraError("تعذر تشغيل الكاميرا — استخدم الإدخال اليدوي تحت"));
        })
        .catch(() => setCameraError("محتاج صلاحية الكاميرا — استخدم الإدخال اليدوي تحت"));
    });

    return () => {
      cancelled = true;
      if (html5QrCode) {
        html5QrCode.stop().catch(() => {}).finally(() => html5QrCode.clear());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  if (authed === null) {
    return <main className="min-h-screen flex items-center justify-center">جاري التحميل...</main>;
  }
  if (authed === false) {
    return (
      <LoginGate
        onLoggedIn={(event) => {
          setEventInfo(event);
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--gold-dark)" }}>
          سكانر الباب
        </h1>
        <button
          onClick={async () => {
            await fetch("/api/scan-auth", { method: "DELETE" });
            await fetch("/api/admin/login", { method: "DELETE" });
            setEventInfo(null);
            setAuthed(false);
          }}
          className="text-xs text-gray-400 underline"
        >
          تسجيل خروج
        </button>
      </div>
      <p className="text-sm text-gray-500 text-center -mt-2">
        {eventInfo ? `زفاف: ${eventInfo.coupleNames}` : "مسؤول المنصة — كل الأفراح"}
      </p>

      <div id={READER_ID} className="card overflow-hidden" />

      {cameraError && <p className="text-sm text-amber-600 text-center">{cameraError}</p>}

      {result && (
        <div
          className="card p-4 text-center font-semibold"
          style={{ color: result.ok ? "#2e7d32" : "#b3261e" }}
        >
          {result.message}
        </div>
      )}

      <div className="card p-4 space-y-2">
        <label className="block text-xs text-gray-500">محاكاة يدوية (مفيش كاميرا؟)</label>
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="الصق كود الـ QR هنا"
            dir="ltr"
            className="flex-1 border rounded-lg px-3 py-2 outline-none text-sm"
            style={{ borderColor: "#eee0cc" }}
          />
          <button
            onClick={() => submitCode(manualCode)}
            className="btn-gold px-4 py-2 rounded-lg text-sm font-semibold"
          >
            تحقق
          </button>
        </div>
      </div>
    </main>
  );
}
