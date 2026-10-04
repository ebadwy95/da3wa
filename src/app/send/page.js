"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SendIcon, LogOutIcon, CheckCircleIcon, SearchIcon } from "@/components/icons";
import InstallHint from "@/components/InstallHint";

// The sending app: the groom or the bride, one list of their guests, and on
// each guest one button for whichever message is due next. Pressing it opens
// WhatsApp on that guest's chat with the message written out; they press
// send there, and come back for the next one.
//
// Written in Gulf Arabic, like everything the couple and their guests read.

const STEP_LABEL = {
  invite: "إرسال الدعوة",
  qr: "إرسال بطاقة الدخول",
  reminder: "إرسال التذكير",
  thanks: "إرسال الشكر",
};
const STEP_NAME = { invite: "الدعوة", qr: "بطاقة الدخول", reminder: "التذكير", thanks: "الشكر" };
// One colour per message, so the list reads at a glance: which guests are on
// which message.
const STEP_COLOR = {
  invite: "#a8823f",
  qr: "#2f5f9e",
  reminder: "#7a4a9e",
  thanks: "#1d5c47",
};
const STEPS = ["invite", "qr", "reminder", "thanks"];

// A phone with both WhatsApp and WhatsApp Business asks "open with which?"
// for every wa.me link — two hundred times over a guest list. Both phones can
// name the app instead: Android with an intent link, iPhone with each app's
// own URL scheme. So the choice is asked once and remembered on this phone.
const WA_PACKAGES = { personal: "com.whatsapp", business: "com.whatsapp.w4b" };
const WA_SCHEMES = { personal: "whatsapp", business: "whatsapp-business" };
const WA_PREF_KEY = "da3wa-send-whatsapp";

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function readWaPref() {
  try {
    return localStorage.getItem(WA_PREF_KEY);
  } catch {
    return null;
  }
}

function saveWaPref(value) {
  try {
    localStorage.setItem(WA_PREF_KEY, value);
  } catch {}
}

function openWhatsApp(link, pref) {
  const pkg = WA_PACKAGES[pref];
  if (isAndroid() && pkg) {
    const url = new URL(link);
    const phone = url.pathname.replace(/[^0-9]/g, "");
    const text = url.searchParams.get("text") || "";
    window.location.href =
      `intent://send/?phone=${phone}&text=${encodeURIComponent(text)}` +
      `#Intent;scheme=whatsapp;package=${pkg};S.browser_fallback_url=${encodeURIComponent(link)};end`;
    return;
  }
  if (isIOS() && WA_SCHEMES[pref]) {
    const url = new URL(link);
    const phone = url.pathname.replace(/[^0-9]/g, "");
    const text = url.searchParams.get("text") || "";
    window.location.href = `${WA_SCHEMES[pref]}://send?phone=${phone}&text=${encodeURIComponent(text)}`;
    // If that app isn't on the phone the scheme goes nowhere and the page is
    // still showing; fall back to the ordinary link.
    setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = link;
    }, 1500);
    return;
  }
  window.open(link, "_blank", "noopener");
}

function WhatsAppPicker({ onPick, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCancel}>
      <div className="card w-full max-w-md p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold text-center">ترسل من أي واتساب؟</p>
        <p className="hint text-center" style={{ margin: 0 }}>نسألك مرة وحدة بس — وتقدر تغيّرها بعدين من فوق.</p>
        <button onClick={() => onPick("personal")} className="pill-btn w-full" style={{ background: "#1d5c47", borderColor: "#1d5c47" }}>
          واتساب العادي
        </button>
        <button onClick={() => onPick("business")} className="pill-btn w-full" style={{ background: "#2f5f9e", borderColor: "#2f5f9e" }}>
          واتساب بزنس
        </button>
      </div>
    </div>
  );
}

function dayLabel(iso) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ar-KW", { day: "numeric", month: "long" });
}

function LoginForm({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/send-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "ما قدرنا ندخلك");
    onDone();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card max-w-sm w-full p-8 flex flex-col gap-4 text-center">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full self-center" style={{ background: "#e3efe9", color: "#1d5c47" }}>
          <SendIcon size={26} />
        </span>
        <h1 className="title" style={{ color: "#1d5c47" }}>إرسال الدعوات</h1>
        <p className="meta leading-relaxed">ادخل باسم المستخدم وكلمة المرور اللي وصلتك من دعوة.</p>
        <div className="text-right">
          <label className="label" htmlFor="u">اسم المستخدم</label>
          <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} className="field" dir="ltr" autoCapitalize="none" autoComplete="username" />
        </div>
        <div className="text-right">
          <label className="label" htmlFor="p">كلمة المرور</label>
          <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" dir="ltr" autoComplete="current-password" />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy} className="pill-btn w-full" style={{ background: "#1d5c47", borderColor: "#1d5c47" }}>
          {busy ? "..." : "دخول"}
        </button>
        <InstallHint label="ثبّت التطبيق على الشاشة" appName="إرسال دعوة" />
      </form>
    </main>
  );
}

// Four dots, one per message: grey to do, amber sent, green opened.
function StepDots({ steps }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {STEPS.map((s) => {
        const state = steps[s].state;
        const bg =
          state === "done" ? "var(--ok)" : state === "sent" ? "#d99a1e" : state === "skip" ? "transparent" : "var(--line)";
        return (
          <span
            key={s}
            title={STEP_NAME[s]}
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              background: bg,
              border: state === "skip" ? "1px dashed var(--line)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function GuestCard({ guest, onTap, onUndo, busy }) {
  const { steps } = guest;
  const current = steps.current;
  const cur = current ? steps[current] : null;

  // Messages sent but not yet opened, other than the one the button is for.
  const waiting = STEPS.filter((s) => s !== current && steps[s].state === "sent");

  let tint = "var(--surface)";
  if (guest.status === "declined") tint = "#f1eeea";
  else if (!current) tint = "var(--ok-bg)";
  else if (cur.state === "sent") tint = "#fbf1dc";

  return (
    <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: tint, border: "1px solid var(--line-soft)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold truncate">
            {guest.name}
            {guest.language === "en" && <span className="chip chip-info mr-2" style={{ fontSize: "0.7rem" }}>English</span>}
          </p>
          <p className="meta tnum" dir="ltr" style={{ textAlign: "right" }}>{guest.phone}</p>
        </div>
        <StepDots steps={steps} />
      </div>

      {waiting.map((s) => (
        <p key={s} className="text-xs" style={{ color: "#9a6a0a" }}>
          {STEP_NAME[s]}: انرسلت — ننتظر الضيف يفتحها
        </p>
      ))}

      {guest.status === "declined" ? (
        <p className="text-sm font-semibold text-ink-2">اعتذر عن الحضور — ما يحتاج رسائل ثانية</p>
      ) : !current ? (
        <p className="text-sm font-semibold flex items-center gap-1" style={{ color: "var(--ok)" }}>
          <CheckCircleIcon size={16} /> خلصت كل الرسائل
        </p>
      ) : cur.state === "locked" ? (
        <>
          <button disabled className="pill-btn w-full" style={{ background: "var(--line-soft)", borderColor: "var(--line-soft)", color: "var(--ink-3)" }}>
            {cur.reason === "date"
              ? `${STEP_NAME[current]} يفتح يوم ${dayLabel(cur.until)}`
              : `${STEP_NAME[current]} — ننتظر الضيف يأكد حضوره`}
          </button>
          {cur.reason === "date" && (
            <p className="text-xs text-ink-2 text-center">تبي ترسله قبل؟ كلّم الأدمن يفتحه لك.</p>
          )}
          {cur.reason === "waiting_rsvp" && steps.invite.state === "done" && (
            <p className="text-xs text-ink-2 text-center">فتح الدعوة وللحين ما رد.</p>
          )}
        </>
      ) : cur.state === "sent" ? (
        <>
          <p className="text-sm font-semibold" style={{ color: "#9a6a0a" }}>
            {STEP_NAME[current]}: انرسلت — ننتظر الضيف يفتحها
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => onTap(guest, current)}
              className="pill-btn-outline flex-1"
              style={{ borderColor: STEP_COLOR[current], color: STEP_COLOR[current] }}
            >
              فتح واتساب مرة ثانية
            </button>
            <button disabled={busy} onClick={() => onUndo(guest, current)} className="pill-btn-ghost pill-btn-sm">
              ما انرسلت
            </button>
          </div>
        </>
      ) : (
        <button
          disabled={busy}
          onClick={() => onTap(guest, current)}
          className="pill-btn w-full"
          style={{ background: STEP_COLOR[current], borderColor: STEP_COLOR[current], minHeight: "3rem" }}
        >
          {STEP_LABEL[current]}
        </button>
      )}
    </div>
  );
}

export default function SendApp() {
  const [authed, setAuthed] = useState(null);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  // Which WhatsApp to open: "personal", "business", or not chosen yet.
  const [waPref, setWaPref] = useState(null);
  const [picker, setPicker] = useState(null); // { guest, step } waiting on the choice
  const [canPickApp, setCanPickApp] = useState(false);

  useEffect(() => {
    setCanPickApp(isAndroid() || isIOS());
    setWaPref(readWaPref());
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/send/guests", { cache: "no-store" });
    if (res.status === 401) return setAuthed(false);
    if (res.ok) {
      setData(await res.json());
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Back from WhatsApp, and every so often while open: opens by guests turn
  // rows green without anyone pulling to refresh.
  useEffect(() => {
    if (!authed) return;
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [authed, load]);

  async function tap(guest, step, pref = waPref) {
    if (canPickApp && !WA_PACKAGES[pref]) {
      setPicker({ guest, step });
      return;
    }
    // Opened first, inside the tap: a window opened after an await has lost
    // the gesture that allows it, and the phone blocks it.
    openWhatsApp(guest.links[step], pref);
    setBusy(true);
    await fetch("/api/send/tap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: guest.id, step }),
    }).catch(() => {});
    await load();
    setBusy(false);
  }

  async function undo(guest, step) {
    setBusy(true);
    await fetch("/api/send/tap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: guest.id, step, undo: true }),
    }).catch(() => {});
    await load();
    setBusy(false);
  }

  const counts = useMemo(() => {
    const c = { all: 0, invite: 0, qr: 0, reminder: 0, thanks: 0, waiting: 0, done: 0 };
    for (const g of data?.guests || []) {
      c.all += 1;
      const cur = g.steps.current;
      if (!cur || g.status === "declined") c.done += 1;
      else if (g.steps[cur].state === "todo") c[cur] += 1;
      else c.waiting += 1;
    }
    return c;
  }, [data]);

  const visible = useMemo(() => {
    const q = query.trim();
    return (data?.guests || []).filter((g) => {
      if (q && !g.name.includes(q) && !g.phone.includes(q)) return false;
      const cur = g.steps.current;
      if (filter === "all") return true;
      if (filter === "done") return !cur || g.status === "declined";
      if (filter === "waiting") return cur && g.status !== "declined" && g.steps[cur].state !== "todo";
      return cur === filter && g.steps[cur].state === "todo";
    });
  }, [data, filter, query]);

  if (authed === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="meta">جاري التحميل...</p>
      </main>
    );
  }
  if (authed === false) return <LoginForm onDone={load} />;

  const sideLabel = data.side === "bride" ? "ضيوف العروس" : "ضيوف العريس";
  const tabs = [
    ["all", "الكل"],
    ["invite", "الدعوة"],
    ["qr", "بطاقة الدخول"],
    ["reminder", "التذكير"],
    ["thanks", "الشكر"],
    ["waiting", "ننتظر الضيف"],
    ["done", "خلصوا"],
  ];

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col gap-3">
      {picker && (
        <WhatsAppPicker
          onCancel={() => setPicker(null)}
          onPick={(choice) => {
            saveWaPref(choice);
            setWaPref(choice);
            const pending = picker;
            setPicker(null);
            tap(pending.guest, pending.step, choice);
          }}
        />
      )}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="title" style={{ color: "#1d5c47" }}>{sideLabel}</h1>
          <p className="meta">{data.event.coupleNames}</p>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/send-auth", { method: "DELETE" });
            setAuthed(false);
            setData(null);
          }}
          className="pill-btn-ghost pill-btn-sm"
        >
          <LogOutIcon size={15} /> خروج
        </button>
      </header>

      <InstallHint label="ثبّت التطبيق على الشاشة" appName="إرسال دعوة" />

      {canPickApp && WA_PACKAGES[waPref] && (
        <p className="text-xs text-ink-2 flex items-center gap-2">
          ترسل من: <b>{waPref === "business" ? "واتساب بزنس" : "واتساب العادي"}</b>
          <button
            onClick={() => {
              saveWaPref("");
              setWaPref(null);
            }}
            className="underline"
            style={{ color: "#1d5c47" }}
          >
            تغيير
          </button>
        </p>
      )}

      <div className="card-flat p-3 text-xs leading-relaxed text-ink-2">
        اضغط الزر، بيفتح واتساب والرسالة جاهزة — اضغط إرسال وارجع هني. أول شي أرسل الدعوة لكل القائمة، بعدين
        ارجع من فوق وأرسل بطاقات الدخول للي أكدوا. السطر يتلوّن أخضر لما الضيف يفتح الرابط.
        {data.reminderFrom && <> التذكير يفتح {dayLabel(data.reminderFrom)}، والشكر {dayLabel(data.thanksFrom)}.</>}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="chip shrink-0"
            style={
              filter === key
                ? { background: STEP_COLOR[key] || "#1d5c47", color: "#fff", borderColor: "transparent" }
                : undefined
            }
          >
            {label} <span className="tnum">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="دوّر باسم أو رقم"
          className="field w-full"
          style={{ paddingInlineStart: "2.25rem" }}
        />
        <span className="absolute" style={{ insetInlineStart: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }}>
          <SearchIcon size={16} />
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="meta text-center py-8">ما في أحد هني.</p>
      ) : (
        visible.map((g) => <GuestCard key={g.id} guest={g} onTap={tap} onUndo={undo} busy={busy} />)
      )}
    </main>
  );
}
