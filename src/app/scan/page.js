"use client";

import { useEffect, useRef, useState } from "react";

const READER_ID = "da3wa-qr-reader";

// A longer siren-style rejection alert (frequency sweeping up and down for
// about 1.6 seconds) rather than a couple of short beeps — loud and
// distinctive enough that door staff notice it even without looking at the
// screen. Pure Web Audio API, no audio file needed.
function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const duration = 1.6;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";

    // Sweep the frequency up and down repeatedly — the classic siren shape.
    const sweepMs = 0.4;
    let t = now;
    osc.frequency.setValueAtTime(500, t);
    while (t < now + duration) {
      osc.frequency.linearRampToValueAtTime(1100, t + sweepMs);
      osc.frequency.linearRampToValueAtTime(500, t + sweepMs * 2);
      t += sweepMs * 2;
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
    gain.gain.setValueAtTime(0.3, now + duration - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Best-effort only — a browser blocking audio shouldn't break scanning.
  }
}

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
              أدخل رمز الزفاف الخاص بك — تحصل عليه من الإدارة، وهو مرتبط
              باسمك مسبقًا، فكل عملية دخول تقوم بها تُسجَّل باسمك تلقائيًا.
              وحتى لو أُقيم أكثر من زفاف في اليوم نفسه، فسيعمل كل رمز بضيوف
              زفافه فقط.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="رمزك"
              dir="ltr"
              className="w-full border rounded-lg px-4 py-3 text-center outline-none tracking-widest font-mono"
              style={{ borderColor: "#eee0cc" }}
              autoFocus
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="pill-btn w-full">دخول</button>
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
            <button className="pill-btn w-full">دخول</button>
            <button
              type="button"
              onClick={() => { setShowAdmin(false); setError(""); }}
              className="text-xs text-gray-400 underline"
            >
              العودة لتسجيل الدخول برمزك
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
  // A validated-but-not-yet-confirmed scan: the door staff must explicitly
  // pick how many people are entering right now and press confirm — a scan
  // alone never counts anyone as having entered.
  const [pending, setPending] = useState(null); // { code, guestName, remaining, partySize, checkedInCount }
  const [pendingCount, setPendingCount] = useState(1);
  const [confirming, setConfirming] = useState(false);
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

  function reject(message) {
    setResult({ ok: false, message });
    setFlash(true);
    playAlertSound();
    setTimeout(() => setFlash(false), 500);
  }

  async function submitCode(code) {
    // Ignore new camera decodes while a confirmation is already pending, or
    // while the exact same code was just handled within the last 3s.
    if (pending) return;
    const now = Date.now();
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < 3000) {
      return;
    }
    lastScanRef.current = { code, at: now };

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, mode: "peek" }),
      });
      const data = await res.json();
      if (!data.ok) {
        reject(data.message || "مرفوض");
        return;
      }
      setResult(null);
      setPendingCount(Math.min(1, data.remaining) || 1);
      setPending({ code, ...data });
    } catch {
      reject("خطأ في الاتصال بالخادم");
    }
  }

  async function confirmEntry() {
    if (!pending) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pending.code, mode: "confirm", count: pendingCount }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPending(null);
        reject(data.message || "مرفوض");
        return;
      }
      setResult(data);
      setPending(null);
    } catch {
      setPending(null);
      reject("خطأ في الاتصال بالخادم");
    } finally {
      setConfirming(false);
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

      {pending && (
        <div className="card p-4 text-center space-y-3" style={{ border: "2px solid var(--gold)" }}>
          <p className="font-bold text-lg" style={{ color: "var(--gold-dark)" }}>
            {pending.guestName}
          </p>
          <p className="text-sm text-gray-500">
            المسموح به: {pending.partySize} — دخل حتى الآن: {pending.checkedInCount} — المتبقّي: {pending.remaining}
          </p>
          <p className="text-sm font-semibold">كم شخصًا من هذه الدعوة يدخل الآن؟</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: pending.remaining }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPendingCount(n)}
                className="w-10 h-10 rounded-full border font-semibold"
                style={
                  pendingCount === n
                    ? { background: "var(--gold)", color: "#fff", borderColor: "var(--gold)" }
                    : { borderColor: "#eee0cc" }
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={confirmEntry} disabled={confirming} className="pill-btn flex-1">
              {confirming ? "..." : `تأكيد دخول ${pendingCount} ✅`}
            </button>
            <button onClick={() => setPending(null)} className="pill-btn-outline">إلغاء</button>
          </div>
        </div>
      )}

      {!pending && result && (
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
            className="pill-btn text-sm"
          >
            تحقق
          </button>
        </div>
      </div>
    </main>
  );
}
