"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SendIcon, LogOutIcon, CheckCircleIcon, SearchIcon, PhoneIcon, MessageIcon } from "@/components/icons";
import InstallHint from "@/components/InstallHint";

// The sending app: the groom or the bride, one list of their guests, and on
// each guest one button — the invitation, the only message there is. Pressing
// it opens WhatsApp on that guest's chat with the message written out; they
// press send there, and come back for the next one. After that the row just
// follows the guest: opened, confirmed, declined.
//
// Written in Gulf Arabic, like everything the couple and their guests read.

// Where each guest stands, and the colour of their row.
const STAGE = {
  todo: { label: "ما انرسلت له", color: "#a8823f", tint: "var(--surface)" },
  sent: { label: "انرسلت — ننتظر يفتحها", color: "#9a6a0a", tint: "#fbf1dc" },
  opened: { label: "فتح الدعوة وللحين ما رد", color: "#2f5f9e", tint: "#e8eef7" },
  confirmed: { label: "أكد الحضور", color: "var(--ok)", tint: "var(--ok-bg)" },
  declined: { label: "اعتذر عن الحضور", color: "var(--ink-3)", tint: "#f1eeea" },
};

function seatsLabel(n) {
  if (n === 1) return "شخص واحد";
  if (n === 2) return "شخصين";
  return `${n} أشخاص`;
}

// A phone with both WhatsApp and WhatsApp Business asks "open with which?"
// for every wa.me link — two hundred times over a guest list. On Android the
// link can name the app instead, so the choice is asked once and remembered
// on this phone.
//
// iPhone can't be helped: with both installed, iOS hands every WhatsApp link
// and scheme (whatsapp:// included) to WhatsApp Business, which then asks
// itself. Tried on a real phone; a phone with one WhatsApp never asks.
const WA_PACKAGES = { personal: "com.whatsapp", business: "com.whatsapp.w4b" };
const WA_PREF_KEY = "da3wa-send-whatsapp";

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
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

// How many people the invitation is for. Changeable here until it is sent —
// after that the guest may already be reading a card with the old number.
function PartySize({ guest, onResize, busy }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(guest.maxGuests);
  const [error, setError] = useState("");

  async function save(next) {
    setError("");
    const ok = await onResize(guest, next);
    if (ok === true) setEditing(false);
    else setError(ok || "ما قدرنا نحفظ");
  }

  if (!guest.sizeEditable) {
    return <span className="text-xs text-ink-2">العدد: {seatsLabel(guest.maxGuests)}</span>;
  }
  if (!editing) {
    return (
      <button type="button" onClick={() => { setValue(guest.maxGuests); setEditing(true); }} className="text-xs text-ink-2 underline self-start" aria-label={`تعديل عدد ${guest.name}`}>
        العدد: {seatsLabel(guest.maxGuests)} ✏️
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-ink-2">العدد:</span>
      <button type="button" disabled={busy || value <= 1} onClick={() => setValue((v) => Math.max(1, v - 1))} className="pill-btn-outline pill-btn-sm" style={{ minWidth: "2.2rem" }} aria-label="أقل">−</button>
      <span className="font-bold tnum" style={{ minWidth: "1.5rem", textAlign: "center" }}>{value}</span>
      <button type="button" disabled={busy || value >= 30} onClick={() => setValue((v) => Math.min(30, v + 1))} className="pill-btn-outline pill-btn-sm" style={{ minWidth: "2.2rem" }} aria-label="أكثر">+</button>
      <button type="button" disabled={busy} onClick={() => save(value)} className="pill-btn pill-btn-sm" style={{ background: "#1d5c47", borderColor: "#1d5c47" }}>حفظ</button>
      <button type="button" onClick={() => setEditing(false)} className="pill-btn-ghost pill-btn-sm">إلغاء</button>
      {error && <span className="text-danger text-xs w-full">{error}</span>}
    </div>
  );
}

// For a guest who got the invitation and hasn't answered: a call, or a plain
// WhatsApp chat (no message written) to follow up in their own words.
function FollowUp({ guest, waPref }) {
  const digits = String(guest.phone).replace(/[^0-9]/g, "");
  return (
    <div className="flex gap-2">
      <a href={`tel:+${digits}`} className="pill-btn-outline pill-btn-sm flex-1" aria-label={`اتصال بـ${guest.name}`}>
        <PhoneIcon size={15} /> اتصال
      </a>
      <button
        type="button"
        onClick={() => openWhatsApp(`https://wa.me/${digits}`, waPref)}
        className="pill-btn pill-btn-sm flex-1"
        style={{ background: "#1d5c47", borderColor: "#1d5c47" }}
        aria-label={`واتساب ${guest.name}`}
      >
        <MessageIcon size={15} /> واتساب
      </button>
    </div>
  );
}

function GuestCard({ guest, onTap, onUndo, onResize, busy, waPref }) {
  const stage = STAGE[guest.stage];
  const thanksColor = "#1d5c47";
  return (
    <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: stage.tint, border: "1px solid var(--line-soft)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold truncate">
            {guest.name}
            {guest.language === "en" && <span className="chip chip-info mr-2" style={{ fontSize: "0.7rem" }}>English</span>}
          </p>
          <p className="meta tnum" dir="ltr" style={{ textAlign: "right" }}>{guest.phone}</p>
          {guest.stage !== "confirmed" && guest.stage !== "declined" && (
            <PartySize guest={guest} onResize={onResize} busy={busy} />
          )}
        </div>
        {guest.stage !== "todo" && (
          <span className="text-xs font-semibold shrink-0 flex items-center gap-1" style={{ color: stage.color }}>
            {guest.stage === "confirmed" && <CheckCircleIcon size={14} />}
            {stage.label}
            {guest.stage === "confirmed" && guest.seats ? ` — ${seatsLabel(guest.seats)}` : ""}
          </span>
        )}
      </div>

      {guest.stage === "todo" && (
        <button
          disabled={busy}
          onClick={() => onTap(guest)}
          className="pill-btn w-full"
          style={{ background: stage.color, borderColor: stage.color, minHeight: "3rem" }}
        >
          إرسال الدعوة
        </button>
      )}
      {guest.stage === "sent" && (
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => onTap(guest)} className="pill-btn-outline flex-1" style={{ borderColor: stage.color, color: stage.color }}>
            فتح واتساب مرة ثانية
          </button>
          <button disabled={busy} onClick={() => onUndo(guest)} className="pill-btn-ghost pill-btn-sm">
            ما انرسلت
          </button>
        </div>
      )}
      {(guest.stage === "sent" || guest.stage === "opened") && <FollowUp guest={guest} waPref={waPref} />}

      {/* After the wedding: the thank-you, whenever they like. */}
      {guest.thanks === "todo" && (
        <button
          disabled={busy}
          onClick={() => onTap(guest, undefined, "thanks")}
          className="pill-btn w-full"
          style={{ background: thanksColor, borderColor: thanksColor, minHeight: "3rem" }}
        >
          إرسال الشكر
        </button>
      )}
      {guest.thanks === "sent" && (
        <div className="flex gap-2 items-center">
          <span className="text-xs font-semibold flex-1" style={{ color: "#9a6a0a" }}>انرسل الشكر — ننتظر يفتحه</span>
          <button disabled={busy} onClick={() => onTap(guest, undefined, "thanks")} className="pill-btn-outline pill-btn-sm" style={{ borderColor: thanksColor, color: thanksColor }}>
            فتح واتساب مرة ثانية
          </button>
          <button disabled={busy} onClick={() => onUndo(guest, "thanks")} className="pill-btn-ghost pill-btn-sm">
            ما انرسل
          </button>
        </div>
      )}
      {guest.thanks === "done" && (
        <p className="text-xs font-semibold flex items-center gap-1" style={{ color: thanksColor }}>
          <CheckCircleIcon size={14} /> وصله الشكر
        </p>
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
    setCanPickApp(isAndroid());
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

  async function tap(guest, pref = waPref, step = "invite") {
    if (canPickApp && !WA_PACKAGES[pref]) {
      setPicker({ guest, step });
      return;
    }
    // Opened first, inside the tap: a window opened after an await has lost
    // the gesture that allows it, and the phone blocks it.
    openWhatsApp(step === "thanks" ? guest.thanksLink : guest.link, pref);
    setBusy(true);
    await fetch("/api/send/tap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: guest.id, step }),
    }).catch(() => {});
    await load();
    setBusy(false);
  }

  // Returns true when saved, or the reason it was refused.
  async function resize(guest, maxGuests) {
    setBusy(true);
    try {
      const res = await fetch("/api/send/size", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: guest.id, maxGuests }),
      });
      const json = await res.json().catch(() => ({}));
      await load();
      return res.ok ? true : json.error;
    } catch {
      return "ما قدرنا نوصل للسيرفر";
    } finally {
      setBusy(false);
    }
  }

  async function undo(guest, step = "invite") {
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
    const c = { all: 0, todo: 0, sent: 0, opened: 0, noreply: 0, confirmed: 0, declined: 0, thanks: 0 };
    for (const g of data?.guests || []) {
      c.all += 1;
      c[g.stage] += 1;
      if (g.stage === "sent" || g.stage === "opened") c.noreply += 1;
      if (g.thanks === "todo") c.thanks += 1;
    }
    return c;
  }, [data]);

  const visible = useMemo(() => {
    const q = query.trim();
    return (data?.guests || []).filter((g) => {
      if (q && !g.name.includes(q) && !g.phone.includes(q)) return false;
      if (filter === "thanks") return g.thanks === "todo";
      if (filter === "noreply") return g.stage === "sent" || g.stage === "opened";
      return filter === "all" || g.stage === filter;
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
    ["todo", "ما انرسلت"],
    ["noreply", "ما ردّوا"],
    ["sent", "ننتظر يفتحون"],
    ["opened", "فتحوا وما ردوا"],
    ["confirmed", "أكدوا"],
    ["declined", "اعتذروا"],
    ...(data.thanksOpen ? [["thanks", "باقي الشكر"]] : []),
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
            tap(pending.guest, choice, pending.step);
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
        اضغط «إرسال الدعوة»، بيفتح واتساب والرسالة جاهزة — اضغط إرسال وارجع هني. هذي الرسالة الوحيدة: أول ما
        الضيف يأكد، نفس الرابط يصير بطاقة دخوله، وفيه موقع القاعة وزر يضيف الموعد لتقويمه. وبعد العرس يطلع لكم
        زر «إرسال الشكر» للي حضروا، ترسلونه وقت ما تبون.
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="chip shrink-0"
            style={
              filter === key
                ? { background: STAGE[key]?.color || "#1d5c47", color: "#fff", borderColor: "transparent" }
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
        visible.map((g) => <GuestCard key={g.id} guest={g} onTap={tap} onUndo={undo} onResize={resize} busy={busy} waPref={waPref} />)
      )}
    </main>
  );
}
