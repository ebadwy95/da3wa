"use client";

import { useEffect, useRef, useState } from "react";

const READER_ID = "da3wa-qr-reader";

// Two quick beeps via the Web Audio API — no audio file needed, works the
// moment the page loads. Used whenever a scan is rejected (wrong event,
// already fully used, declined, invalid...) so the door staff notices even
// if they're not looking straight at the screen.
function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.17);
    });
  } catch {
    // Best-effort only — a browser blocking audio shouldn't break scanning.
  }
}

function LoginGate({ onLoggedIn }) {
  const [code, setCode] = useState("");
  const [staffName, setStaffName] = useState("");
  const [error, setError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [password, setPassword] = useState("");

  async function submitCode(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/scan-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, staffName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "الرمز غير صحيح");
      return;
    }
    onLoggedIn(data.event, data.staffName);
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
    onLoggedIn(null, "مسؤول المنصة");
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
              أدخل رمز الزفاف الخاص بهذا الباب — لكل زفاف رمز مختلف، وحتى لو
              أُقيم أكثر من زفاف في اليوم نفسه، فسيعمل كل جهاز مسح بضيوف
              زفافه فقط.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="رمز الزفاف"
              dir="ltr"
              className="w-full border rounded-lg px-4 py-3 text-center outline-none tracking-widest font-mono"
              style={{ borderColor: "#eee0cc" }}
              autoFocus
            />
            <div>
              <input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="اسمك"
                required
                className="w-full border rounded-lg px-4 py-3 text-center outline-none"
                style={{ borderColor: "#eee0cc" }}
              />
              <p className="text-xs text-gray-400 mt-1">
                سيُسجَّل مع كل عملية دخول تقوم بها — حتى إذا كان أكثر من شخص يستخدم الماسح على الباب نفسه، يمكن معرفة من قام بكل عملية.
              </p>
            </div>
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
              العودة لتسجيل الدخول برمز الزفاف
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
  const [staffName, setStaffName] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(false);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ code: null, at: 0 });

  useEffect(() => {
    fetch("/api/scan-auth").then(async (res) => {
      const data = await res.json().catch(() => ({}));
      setAuthed(Boolean(data.authed));
      setEventInfo(data.event || null);
      setStaffName(data.staffName || "");
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
      setResult(data);
      if (!data.ok) {
        setFlash(true);
        playAlertSound();
        setTimeout(() => setFlash(false), 500);
      }
    } catch {
      setResult({ ok: false, message: "خطأ في الاتصال بالخادم" });
      setFlash(true);
      playAlertSound();
      setTimeout(() => setFlash(false), 500);
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
            setCameraError("لا توجد كاميرا متاحة — استخدم الإدخال اليدوي أدناه");
            return;
          }
          const cameraId = cameras.find((c) => /back|rear/i.test(c.label))?.id || cameras[0].id;
          html5QrCode
            .start(
              cameraId,
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText) => submitCode(decodedText)
            )
            .catch(() => setCameraError("تعذّر تشغيل الكاميرا — استخدم الإدخال اليدوي أدناه"));
        })
        .catch(() => setCameraError("يلزم إذن الوصول إلى الكاميرا — استخدم الإدخال اليدوي أدناه"));
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
        onLoggedIn={(event, name) => {
          setEventInfo(event);
          setStaffName(name || "");
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto space-y-4 relative">
      {flash && (
        <div
          className="fixed inset-0 pointer-events-none z-50 da3wa-flash-overlay"
          style={{ background: "rgba(211,47,47,0.55)" }}
        />
      )}

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
        {staffName && <span className="block text-xs text-gray-400 mt-0.5">تم تسجيل الدخول باسم: {staffName}</span>}
      </p>

      <div id={READER_ID} className="card overflow-hidden" />

      {cameraError && <p className="text-sm text-amber-600 text-center">{cameraError}</p>}

      {result && (
        <div
          className="card p-4 text-center space-y-1"
          style={{
            background: result.ok ? "transparent" : "#fdecea",
            border: result.ok ? undefined : "2px solid #b3261e",
          }}
        >
          <p className="font-bold text-lg" style={{ color: result.ok ? "#2e7d32" : "#b3261e" }}>
            {result.ok ? "✅ دخول ناجح" : "⛔ مرفوض"}
          </p>
          <p className="font-semibold" style={{ color: result.ok ? "#2e7d32" : "#b3261e" }}>
            {result.message}
          </p>
        </div>
      )}

      <div className="card p-4 space-y-2">
        <label className="block text-xs text-gray-500">محاكاة يدوية (لا توجد كاميرا؟)</label>
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="الصق رمز الـ QR هنا"
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
