"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldIcon, AlertIcon, CheckCircleIcon, ClockIcon } from "@/components/icons";
import { unlockAudio, startRing, stopAlarm, registerAlertWorker, keepScreenOn } from "@/lib/alarm";

const POLL_MS = 5000;
// An alert older than this no longer sets the page ringing when it is opened —
// it is history by then, not a call.
const RING_WINDOW_MS = 15 * 60 * 1000;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
}

function describe(alert) {
  if (alert.type === "sos") return `🚨 طوارئ — ${alert.staffName || "موظف الباب"} ضغط زر الطوارئ`;
  if (alert.type === "duplicate") {
    return `⚠️ باركود مستخدم${alert.guestName ? ` — بطاقة ${alert.guestName}` : ""}${alert.staffName ? ` (عند ${alert.staffName})` : ""}`;
  }
  return "تنبيه";
}

export default function GuardScreen({ guardKey, contactName, coupleNames, eventDate, venueName, vapidKey }) {
  const [env, setEnv] = useState(null); // { supported, ios, standalone, permission }
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [ringing, setRinging] = useState(null);
  const [onDuty, setOnDuty] = useState(false);
  const installPrompt = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const silenced = useRef(new Set());

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setEnv({ supported, ios, standalone, permission: supported ? Notification.permission : "unsupported" });

    if (supported) {
      registerAlertWorker().then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(Boolean(sub) && Notification.permission === "granted");
      });
    }

    const onPrompt = (e) => {
      e.preventDefault();
      installPrompt.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/security/alerts?key=${encodeURIComponent(guardKey)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const list = data.alerts || [];
    setAlerts(list);
    const live = list.find(
      (a) =>
        !a.ackedByMe &&
        !silenced.current.has(a.id) &&
        Date.now() - new Date(a.createdAt).getTime() < RING_WINDOW_MS
    );
    setRinging((current) => {
      if (live && current?.id !== live.id) startRing();
      if (!live && current) stopAlarm();
      return live || null;
    });
  }, [guardKey]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    // The service worker tells an open page the moment a push lands, so the
    // page rings at once instead of on its next poll.
    const onMessage = (e) => {
      if (e.data?.type === "security-alert" || e.data?.type === "security-acked") refresh();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      stopAlarm();
    };
  }, [refresh]);

  async function activate() {
    setBusy(true);
    setError("");
    setNotice("");
    unlockAudio();
    try {
      const permission = await Notification.requestPermission();
      setEnv((e) => ({ ...e, permission }));
      if (permission !== "granted") {
        throw new Error("التنبيهات مرفوضة — افتح إعدادات التلفون واسمح بالإشعارات لهالتطبيق، وبعدين جرّب مرة ثانية");
      }
      const reg = await registerAlertWorker();
      if (!reg) throw new Error("هالمتصفح ما يدعم التنبيهات");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      const res = await fetch("/api/security/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: guardKey, subscription: sub.toJSON() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر التفعيل");
      setSubscribed(true);
      setNotice("تم التفعيل ✓ — المفروض يوصلك الحين إشعار تجربة. إذا ما وصل، تأكد إن الإشعارات مسموحة والتلفون مو صامت.");
    } catch (err) {
      // The browser's own errors arrive in English ("Registration failed -
      // permission denied"); the person reading this is at a wedding gate.
      setError(
        /[\u0600-\u06FF]/.test(err.message)
          ? err.message
          : "تعذّر التفعيل — افتح الرابط في Chrome أو Safari العادي (مو نافذة خفية)، واسمح بالإشعارات، وجرّب مرة ثانية."
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setNotice("");
    unlockAudio();
    const res = await fetch("/api/security/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: guardKey, type: "test" }),
    });
    const data = await res.json().catch(() => ({}));
    setNotice(
      data.notified?.length
        ? "انرسل إشعار تجربة — المفروض يرن الحين."
        : "ما في جهاز مفعّل يوصله الإشعار — اضغط «تفعيل التنبيهات» أول."
    );
  }

  async function acknowledge(alert) {
    silenced.current.add(alert.id);
    stopAlarm();
    setRinging(null);
    await fetch("/api/security/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: guardKey, alertId: alert.id }),
    }).catch(() => {});
    refresh();
  }

  async function startDuty() {
    unlockAudio();
    await keepScreenOn();
    setOnDuty(true);
  }

  if (!env) return null;
  const needsHomeScreen = env.ios && !env.standalone;

  return (
    <main className="min-h-screen p-5 max-w-md mx-auto flex flex-col gap-4">
      {ringing && (
        <div className="fixed inset-0 z-50 da3wa-alarm-overlay flex flex-col items-center justify-center gap-6 p-6 text-center" role="alertdialog" aria-live="assertive">
          <p style={{ color: "#fff", fontSize: "2.25rem", fontWeight: 800, lineHeight: 1.3 }}>
            {ringing.type === "sos" ? "🚨 طوارئ عند البوابة" : "⚠️ باركود مستخدم عند البوابة"}
          </p>
          <p style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 600, lineHeight: 1.6 }}>
            {describe(ringing)}
            <br />
            {timeOf(ringing.createdAt)} — تعال البوابة الحين
          </p>
          <button
            onClick={() => acknowledge(ringing)}
            style={{ background: "#fff", color: "#a6321f", fontSize: "1.6rem", fontWeight: 800, borderRadius: "9999px", padding: "1.1rem 2.5rem", minWidth: "15rem" }}
          >
            🏃 أنا جاي
          </button>
          {ringing.acks?.length > 0 && (
            <p style={{ color: "#fff" }}>في الطريق: {ringing.acks.map((a) => a.name).join("، ")}</p>
          )}
        </div>
      )}

      <header className="card p-5 flex flex-col gap-2 text-center" style={{ borderTop: "4px solid #a6321f" }}>
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full self-center" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <ShieldIcon size={28} />
        </span>
        <h1 className="title">أهلًا {contactName}</h1>
        <p className="meta leading-relaxed">
          إنت ضمن فريق الأمن لعرس <b>{coupleNames}</b>
          {eventDate ? ` — ${eventDate}` : ""}
          {venueName ? ` — ${venueName}` : ""}. أي نداء طوارئ من البوابة، أو أي أحد يقدّم باركود انمسح من قبل، بيرن عندك هني على طول.
        </p>
      </header>

      {!env.supported && !needsHomeScreen && (
        <p className="card-flat p-4" style={{ color: "var(--danger)", background: "var(--danger-bg)" }}>
          هالمتصفح ما يدعم التنبيهات. افتح الرابط من Chrome على الأندرويد، أو من Safari على الآيفون.
        </p>
      )}

      {needsHomeScreen ? (
        <section className="card p-5 flex flex-col gap-3">
          <h2 className="font-bold flex items-center gap-2">
            <AlertIcon size={18} /> خطوة لازمة على الآيفون
          </h2>
          <p className="meta leading-relaxed">الآيفون ما يرسل تنبيهات إلا إذا الصفحة مثبّتة كتطبيق على الشاشة:</p>
          <ol className="flex flex-col gap-2 leading-relaxed" style={{ listStyle: "decimal", paddingInlineStart: "1.25rem" }}>
            <li>افتح هالرابط من <b>Safari</b>.</li>
            <li>اضغط زر <b>المشاركة</b> (المربع اللي طالع منه سهم) تحت.</li>
            <li>اختار <b>«إضافة إلى الشاشة الرئيسية»</b> ثم «إضافة».</li>
            <li>افتح <b>«أمن دعوة»</b> من الشاشة الرئيسية واضغط «تفعيل التنبيهات».</li>
          </ol>
        </section>
      ) : (
        env.supported && (
          <section className="card p-5 flex flex-col gap-3">
            {subscribed ? (
              <>
                <p className="font-bold flex items-center gap-2" style={{ color: "var(--ok)" }}>
                  <CheckCircleIcon size={20} /> التنبيهات شغالة على هالتلفون
                </p>
                <button onClick={sendTest} className="pill-btn-outline">إرسال تنبيه تجربة</button>
              </>
            ) : (
              <button onClick={activate} disabled={busy} className="pill-btn" style={{ minHeight: "3.5rem", fontSize: "var(--text-lg)", background: "#a6321f", borderColor: "#a6321f" }}>
                {busy ? "جارٍ التفعيل..." : "🔔 تفعيل التنبيهات"}
              </button>
            )}
            {canInstall && !env.standalone && (
              <button
                onClick={async () => {
                  installPrompt.current?.prompt();
                  await installPrompt.current?.userChoice;
                  setCanInstall(false);
                }}
                className="pill-btn-outline"
              >
                📲 تثبيت كتطبيق على الشاشة
              </button>
            )}
            {notice && <p className="hint leading-relaxed">{notice}</p>}
            {error && <p className="error leading-relaxed" role="alert">{error}</p>}
          </section>
        )
      )}

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-bold">ليلة العرس</h2>
        <ul className="meta leading-relaxed flex flex-col gap-1" style={{ listStyle: "disc", paddingInlineStart: "1.25rem" }}>
          <li>خل التلفون <b>مو صامت</b> وارفع الصوت.</li>
          <li>الإشعار بيظل يرن ويهتز كل كم ثانية لين تضغط عليه — ضغطتك عليه تعني «أنا جاي» وتطلع عند الباب.</li>
          <li>إذا بتخلي هالصفحة مفتوحة، اضغط «بدء المناوبة» علشان الشاشة ما تطفي والرنة تشتغل.</li>
        </ul>
        <button onClick={startDuty} disabled={onDuty} className="pill-btn-outline">
          {onDuty ? "المناوبة شغالة ✓" : "بدء المناوبة"}
        </button>
      </section>

      <section className="card p-5 flex flex-col gap-2">
        <h2 className="font-bold flex items-center gap-2">
          <ClockIcon size={18} /> آخر التنبيهات
        </h2>
        {alerts.length === 0 ? (
          <p className="meta">ما في تنبيهات — كل شي تمام.</p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="border rounded-lg p-3 flex flex-col gap-1" style={{ borderColor: "var(--line-soft)" }}>
              <p className="font-semibold">{describe(a)}</p>
              <p className="hint">
                {timeOf(a.createdAt)}
                {a.acks?.length ? ` — في الطريق: ${a.acks.map((x) => x.name).join("، ")}` : " — للحين محد رد"}
              </p>
              {!a.ackedByMe && (
                <button onClick={() => acknowledge(a)} className="pill-btn-sm pill-btn-danger self-start">🏃 أنا جاي</button>
              )}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
