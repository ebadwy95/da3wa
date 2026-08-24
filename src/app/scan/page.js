"use client";

import { useEffect, useRef, useState } from "react";
import {
  ScanIcon,
  ShieldIcon,
  CheckCircleIcon,
  BanIcon,
  AlertIcon,
  LogOutIcon,
  UsersIcon,
  LockIcon,
} from "@/components/icons";

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
      <div className="card max-w-sm w-full p-8 flex flex-col gap-5 text-center da3wa-fade-in">
        <div className="flex flex-col items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-14 h-14 rounded-full"
            style={{ background: "var(--gold-50)", color: "var(--gold-600)" }}
          >
            <ShieldIcon size={28} />
          </span>
          <h1 className="title" style={{ color: "var(--gold-600)" }}>
            دخول سكانر الباب
          </h1>
        </div>

        {!showAdmin ? (
          <form onSubmit={submitCode} className="flex flex-col gap-4">
            <p className="meta text-right leading-relaxed">
              أدخل رمز الزفاف الخاص بك — تحصل عليه من الإدارة، وهو مرتبط باسمك
              مسبقًا، فكل عملية دخول تقوم بها تُسجَّل باسمك تلقائيًا. وحتى لو
              أُقيم أكثر من زفاف في اليوم نفسه، فسيعمل كل رمز بضيوف زفافه فقط.
            </p>
            <div className="text-right">
              <label htmlFor="scanner-code" className="label">
                رمزك
              </label>
              {/* No placeholder here on purpose: a centred, letter-spaced
                  sample code inside the box reads as an already-entered
                  value. The format goes in the hint underneath instead. */}
              <input
                id="scanner-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                dir="ltr"
                autoComplete="off"
                autoCapitalize="characters"
                className="field text-center tracking-[0.3em] font-semibold"
                aria-describedby="scanner-code-hint"
                aria-invalid={error ? "true" : undefined}
                autoFocus
              />
              <p id="scanner-code-hint" className="hint">
                ٨ حروف وأرقام، مثل A1B2C3D4
              </p>
            </div>
            {error && (
              <p className="error flex items-center justify-center gap-2" role="alert">
                <AlertIcon size={16} />
                {error}
              </p>
            )}
            <button className="pill-btn w-full">
              <ScanIcon size={18} />
              دخول
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdmin(true);
                setError("");
              }}
              className="pill-btn-ghost pill-btn-sm self-center"
            >
              <LockIcon size={14} />
              دخول كمسؤول المنصة (لكل الأفراح)
            </button>
          </form>
        ) : (
          <form onSubmit={submitAdmin} className="flex flex-col gap-4">
            <div className="text-right">
              <label htmlFor="admin-password" className="label">
                كلمة مرور المنصة
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field text-center"
                aria-invalid={error ? "true" : undefined}
                autoFocus
              />
            </div>
            {error && (
              <p className="error flex items-center justify-center gap-2" role="alert">
                <AlertIcon size={16} />
                {error}
              </p>
            )}
            <button className="pill-btn w-full">دخول</button>
            <button
              type="button"
              onClick={() => {
                setShowAdmin(false);
                setError("");
              }}
              className="pill-btn-ghost pill-btn-sm self-center"
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
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <span className="da3wa-pulse" style={{ color: "var(--gold-300)" }}>
          <ScanIcon size={32} />
        </span>
        <p className="meta">جارٍ التحميل...</p>
      </main>
    );
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
    <main className="min-h-screen p-5 max-w-md mx-auto flex flex-col gap-4 relative">
      {flash && (
        <div
          className="fixed inset-0 pointer-events-none z-50 da3wa-flash-overlay"
          style={{ background: "rgba(166,50,31,0.55)" }}
        />
      )}

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="title flex items-center gap-2" style={{ color: "var(--gold-600)" }}>
            <ScanIcon size={20} />
            سكانر الباب
          </h1>
          <button
            onClick={async () => {
              await fetch("/api/scan-auth", { method: "DELETE" });
              await fetch("/api/admin/login", { method: "DELETE" });
              setEventInfo(null);
              setAuthed(false);
            }}
            className="pill-btn-ghost pill-btn-sm"
          >
            <LogOutIcon size={15} />
            خروج
          </button>
        </div>

        <div className="card-flat px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
            {eventInfo ? eventInfo.coupleNames : "كل الأفراح"}
          </p>
          {staffName && (
            <span className="chip chip-gold">
              <ShieldIcon size={13} />
              {staffName}
            </span>
          )}
        </div>
      </header>

      <div id={READER_ID} className="card overflow-hidden" />

      {cameraError && (
        <p
          className="card-flat p-3 flex items-center gap-2"
          style={{ fontSize: "var(--text-sm)", color: "var(--warn)", background: "var(--warn-bg)", borderColor: "transparent" }}
          role="status"
        >
          <AlertIcon size={18} />
          {cameraError}
        </p>
      )}

      {pending && (
        <section
          className="card p-5 text-center flex flex-col gap-4 da3wa-fade-in"
          style={{ border: "2px solid var(--gold-400)" }}
          aria-live="polite"
        >
          <div className="flex flex-col gap-1">
            <p className="title-lg" style={{ color: "var(--gold-600)" }}>
              {pending.guestName}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="chip chip-neutral tnum">
                <UsersIcon size={13} />
                المسموح {pending.partySize}
              </span>
              <span className="chip chip-info tnum">دخل {pending.checkedInCount}</span>
              <span className="chip chip-gold tnum">المتبقّي {pending.remaining}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p style={{ fontSize: "var(--text-base)", fontWeight: 700 }} id="count-question">
              كم شخصًا من هذه الدعوة يدخل الآن؟
            </p>
            <div
              className="flex flex-wrap justify-center gap-2"
              role="radiogroup"
              aria-labelledby="count-question"
            >
              {Array.from({ length: pending.remaining }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={pendingCount === n}
                  onClick={() => setPendingCount(n)}
                  className="tnum"
                  style={{
                    width: "3.5rem",
                    height: "3.5rem",
                    borderRadius: "9999px",
                    fontSize: "var(--text-xl)",
                    fontWeight: 700,
                    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                    ...(pendingCount === n
                      ? { background: "var(--gold-500)", color: "#fff", border: "2px solid var(--gold-500)" }
                      : { background: "var(--surface)", color: "var(--ink)", border: "2px solid var(--line)" }),
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={confirmEntry}
              disabled={confirming}
              className="pill-btn flex-1"
              style={{ minHeight: "3.25rem", fontSize: "var(--text-base)" }}
            >
              <CheckCircleIcon size={20} />
              {confirming ? "جارٍ التأكيد..." : `تأكيد دخول ${pendingCount}`}
            </button>
            <button
              onClick={() => setPending(null)}
              className="pill-btn-outline"
              style={{ minHeight: "3.25rem" }}
            >
              إلغاء
            </button>
          </div>
        </section>
      )}

      {!pending && result && (
        <section
          className="card p-4 text-center flex flex-col items-center gap-2 da3wa-fade-in"
          style={
            result.ok
              ? { background: "var(--ok-bg)", border: "2px solid var(--ok)" }
              : { background: "var(--danger-bg)", border: "2px solid var(--danger)" }
          }
          role="status"
          aria-live="assertive"
        >
          <p
            className="title flex items-center gap-2"
            style={{ color: result.ok ? "var(--ok)" : "var(--danger)" }}
          >
            {result.ok ? <CheckCircleIcon size={22} /> : <BanIcon size={22} />}
            {result.ok ? "دخول ناجح" : "مرفوض"}
          </p>
          <p
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: result.ok ? "var(--ok)" : "var(--danger)",
            }}
          >
            {result.message}
          </p>
        </section>
      )}

      <div className="card p-4 flex flex-col gap-2">
        <label htmlFor="manual-code" className="label">
          إدخال يدوي (لا توجد كاميرا؟)
        </label>
        <div className="flex gap-2">
          <input
            id="manual-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="الصق رمز الـ QR هنا"
            dir="ltr"
            className="field flex-1"
          />
          <button onClick={() => submitCode(manualCode)} className="pill-btn">
            تحقق
          </button>
        </div>
      </div>
    </main>
  );
}
