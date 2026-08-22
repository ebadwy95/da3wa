"use client";

import { useCallback, useEffect, useState } from "react";
import {
  StatCard,
  GuestRow,
  LimitReachedModal,
  AddGuestForm,
  BulkUpload,
  SendInvitesButton,
  WhatsappFeed,
  CheckinLogFeed,
  WishWall,
} from "@/components/dashboardWidgets";

function LoginForm({ onLoggedIn }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "خطأ في تسجيل الدخول");
      }
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card max-w-sm w-full p-8 space-y-4 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold-dark)" }}>
          دخول لوحة الإدارة
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          className="w-full border rounded-lg px-4 py-3 text-center outline-none focus:ring-2"
          style={{ borderColor: "#eee0cc" }}
          autoFocus
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="btn-gold w-full py-3 rounded-lg font-semibold"
        >
          {loading ? "جاري الدخول..." : "تسجيل الدخول"}
        </button>
      </form>
    </main>
  );
}

function CreateEventForm({ onCreated }) {
  const [form, setForm] = useState({
    groomPhone: "",
    coupleNames: "",
    eventDate: "",
    venueName: "",
    packageLimit: 100,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إنشاء الزفاف");
      onCreated(data.event);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-3 max-w-lg">
      <h2 className="font-bold text-lg">إنشاء زفاف جديد</h2>
      <div>
        <label className="block text-xs text-gray-500 mb-1">رقم واتساب العريس (مطلوب — يكون معرّف الزفاف)</label>
        <input
          value={form.groomPhone}
          onChange={(e) => setForm({ ...form, groomPhone: e.target.value })}
          dir="ltr"
          placeholder="+965XXXXXXXX"
          required
          className="w-full border rounded-lg px-3 py-2 outline-none"
          style={{ borderColor: "#eee0cc" }}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">اسم العروسين</label>
        <input
          value={form.coupleNames}
          onChange={(e) => setForm({ ...form, coupleNames: e.target.value })}
          required
          className="w-full border rounded-lg px-3 py-2 outline-none"
          style={{ borderColor: "#eee0cc" }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">تاريخ الزفاف</label>
          <input
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            placeholder="مثلاً: 20 نوفمبر 2026"
            className="w-full border rounded-lg px-3 py-2 outline-none"
            style={{ borderColor: "#eee0cc" }}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">الحد الأقصى للباقة (عدد الدعوات)</label>
          <input
            type="number"
            min={1}
            value={form.packageLimit}
            onChange={(e) => setForm({ ...form, packageLimit: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 outline-none"
            style={{ borderColor: "#eee0cc" }}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">اسم القاعة (اختياري)</label>
        <input
          value={form.venueName}
          onChange={(e) => setForm({ ...form, venueName: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 outline-none"
          style={{ borderColor: "#eee0cc" }}
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button disabled={saving} className="btn-gold px-6 py-2 rounded-lg font-semibold">
        {saving ? "..." : "إنشاء الزفاف"}
      </button>
    </form>
  );
}

function TestWhatsappSend() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("رسالة تجربة من نظام Da3wa 👋");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-bold">تجربة إرسال واتساب (بدون قالب معتمد)</h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        هذا الإرسال لا يحتاج قالبًا معتمدًا من ميتا، لكنه يعمل فقط ضمن نافذة
        الأربع وعشرين ساعة التي تفتحها واتساب بعد أن يراسل الرقم المطلوب
        اختباره رقم النشاط التجاري المتصل أولًا. إن لم يكن الرقم قد راسل
        النشاط التجاري خلال آخر أربع وعشرين ساعة، سيفشل الإرسال مهما كان
        الرمز صحيحًا — هذا قيد من سياسة واتساب نفسها وليس خللًا في النظام.
      </p>
      <form onSubmit={send} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">الرقم (مع كود الدولة)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            placeholder="+9665XXXXXXXX"
            required
            className="w-full border rounded-lg px-3 py-2 outline-none"
            style={{ borderColor: "#eee0cc" }}
          />
        </div>
        <div className="flex-[2] min-w-[220px]">
          <label className="block text-xs text-gray-500 mb-1">نص الرسالة</label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 outline-none"
            style={{ borderColor: "#eee0cc" }}
          />
        </div>
        <button disabled={sending} className="btn-gold px-6 py-2 rounded-lg font-semibold">
          {sending ? "جاري الإرسال..." : "إرسال تجريبي"}
        </button>
      </form>
      {result && (
        <div
          className="text-sm rounded-lg p-3 space-y-2"
          style={{
            background: result.error ? "#fdecea" : result.simulated ? "#fff4de" : "#e6f4ea",
            color: result.error ? "#b3261e" : result.simulated ? "#a08a2d" : "#2e7d32",
          }}
        >
          <p>
            {result.error
              ? `فشل الإرسال: ${result.error}`
              : result.simulated
              ? `محاكاة فقط (Wati غير متصل): ${result.reason}`
              : "تم قبول الطلب من Wati — إن لم تصل الرسالة فعليًا للرقم رغم ذلك، راجع الرد الخام أدناه، أو جرّب الإرسال مباشرة من لوحة Wati نفسها لعزل المشكلة."}
          </p>
          {result.result && (
            <pre
              className="text-xs p-2 rounded overflow-x-auto"
              style={{ background: "rgba(0,0,0,0.05)", color: "inherit", direction: "ltr", textAlign: "left" }}
            >
              {JSON.stringify(result.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ScannerAccessCard({ event }) {
  const [copied, setCopied] = useState(null);

  const scanLink =
    typeof window !== "undefined" ? `${window.location.origin}/scan` : "/scan";

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="card p-4 space-y-2">
      <h2 className="font-bold">دخول سكانر الباب لهذا الزفاف</h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        سلّم رابط الماسح ورمز الزفاف هذا لموظف الاستقبال عند الباب. هذا الرمز
        خاص بهذا الزفاف فقط — حتى لو كان هناك زفاف آخر يُقام في اليوم نفسه على
        النظام نفسه، فكل جهاز مسح سيعمل بضيوف زفافه فقط، ولن يتمكّن من تسجيل
        دخول ضيوف الزفاف الآخر.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[160px] border rounded-lg px-3 py-2 text-sm" dir="ltr" style={{ borderColor: "#eee0cc" }}>
          {scanLink}
        </div>
        <button onClick={() => copy(scanLink, "link")} className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          {copied === "link" ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="border rounded-lg px-3 py-2 text-sm font-mono tracking-widest" dir="ltr" style={{ borderColor: "#eee0cc" }}>
          {event.scannerCode || "..."}
        </div>
        <button
          onClick={() => copy(event.scannerCode || "", "code")}
          disabled={!event.scannerCode}
          className="text-sm underline"
          style={{ color: "var(--gold-dark)" }}
        >
          {copied === "code" ? "تم النسخ ✓" : "نسخ الرمز"}
        </button>
      </div>
    </div>
  );
}

function CoupleCredentialsCard({ event, onUpdated }) {
  const [copied, setCopied] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const coupleLink =
    typeof window !== "undefined" ? `${window.location.origin}/couple` : "/couple";

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function resetPassword() {
    setResetting(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}/couple-credentials`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذرت إعادة تعيين كلمة المرور");
      onUpdated({ coupleUsername: data.coupleUsername, couplePassword: data.couplePassword, mustChangePassword: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="card p-4 space-y-2">
      <h2 className="font-bold">دخول العروسين للوحة الزفاف</h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        سلّم رابط الدخول واسم المستخدم وكلمة المرور هذه للعروسين، وسيَريان بها
        بيانات زفافهما فقط. عند أول دخول (أو بعد أي إعادة تعيين لكلمة المرور)
        سيُطلب منهما تغيير كلمة المرور قبل المتابعة. إن نسيا كلمة المرور، اضغط
        &quot;إعادة تعيين كلمة المرور&quot; لعرض كلمة مرور جديدة لهما من هنا.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[160px] border rounded-lg px-3 py-2 text-sm" dir="ltr" style={{ borderColor: "#eee0cc" }}>
          {coupleLink}
        </div>
        <button onClick={() => copy(coupleLink, "link")} className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          {copied === "link" ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="border rounded-lg px-3 py-2 text-sm font-mono" dir="ltr" style={{ borderColor: "#eee0cc" }}>
          {event.coupleUsername || "..."}
        </div>
        <button
          onClick={() => copy(event.coupleUsername || "", "username")}
          disabled={!event.coupleUsername}
          className="text-sm underline"
          style={{ color: "var(--gold-dark)" }}
        >
          {copied === "username" ? "تم النسخ ✓" : "نسخ اسم المستخدم"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="border rounded-lg px-3 py-2 text-sm font-mono tracking-widest" dir="ltr" style={{ borderColor: "#eee0cc" }}>
          {event.couplePassword || "..."}
        </div>
        <button
          onClick={() => copy(event.couplePassword || "", "password")}
          disabled={!event.couplePassword}
          className="text-sm underline"
          style={{ color: "var(--gold-dark)" }}
        >
          {copied === "password" ? "تم النسخ ✓" : "نسخ كلمة المرور"}
        </button>
        {event.mustChangePassword && (
          <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: "#fff4de", color: "#a08a2d" }}>
            مطلوب تغييرها عند الدخول
          </span>
        )}
      </div>
      <button
        onClick={resetPassword}
        disabled={resetting}
        className="text-sm underline text-red-500"
      >
        {resetting ? "جاري إعادة التعيين..." : "إعادة تعيين كلمة المرور"}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

function EventDashboard({ event, onDeleted }) {
  const [stats, setStats] = useState(null);
  const [guests, setGuests] = useState([]);
  const [feed, setFeed] = useState({ messages: [], watiConfigured: false });
  const [checkinLogs, setCheckinLogs] = useState([]);
  const [coupleOverrides, setCoupleOverrides] = useState({});
  const eventForDisplay = { ...event, ...coupleOverrides };

  const refresh = useCallback(async () => {
    const [statsRes, guestsRes, feedRes, logsRes] = await Promise.all([
      fetch(`/api/stats?eventId=${event.id}`),
      fetch(`/api/events/${event.id}/guests`),
      fetch(`/api/whatsapp/feed?eventId=${event.id}`),
      fetch(`/api/events/${event.id}/checkin-logs`),
    ]);
    setStats((await statsRes.json()).stats);
    setGuests((await guestsRes.json()).guests);
    setFeed(await feedRes.json());
    setCheckinLogs((await logsRes.json()).logs || []);
  }, [event.id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function deleteGuest(id) {
    await fetch(`/api/guests/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">{event.coupleNames}</h2>
          <p className="text-xs text-gray-500" dir="ltr">
            {event.groomPhoneDisplay} — الباقة: {event.packageLimit} دعوة
          </p>
        </div>
        <button
          onClick={async () => {
            await fetch(`/api/events/${event.id}`, { method: "DELETE" });
            onDeleted();
          }}
          className="text-sm text-red-500 underline"
        >
          حذف الزفاف
        </button>
      </div>

      <ScannerAccessCard event={event} />
      <CoupleCredentialsCard event={eventForDisplay} onUpdated={(patch) => setCoupleOverrides((prev) => ({ ...prev, ...patch }))} />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="إجمالي الدعوات" value={stats.invited} />
          <StatCard label="أكدوا" value={stats.confirmed} accent="#2e7d32" />
          <StatCard label="لم يردّوا بعد" value={stats.pending} accent="#a08a5a" />
          <StatCard label="اعتذروا" value={stats.declined} accent="#b3261e" />
          <StatCard label="إجمالي الحضور المتوقع" value={stats.expectedAttendees} accent="#6a4fb3" />
          <StatCard label="دخلوا فعلاً (عدد الأفراد)" value={stats.peopleCheckedIn} accent="#1a73e8" />
        </div>
      )}
      <p className="text-xs text-gray-400 -mt-3">
        &quot;إجمالي الدعوات&quot; = عدد الضيوف المضافين، بصرف النظر عن حالتهم. &quot;إجمالي الحضور المتوقع&quot; = مجموع
        كل ضيف مؤكَّد زائد عدد مرافقيه الذين أكّدهم فعليًا. &quot;دخلوا فعلًا&quot; = عدد الأفراد الذين سُجِّل دخولهم فعليًا
        عند الباب حتى الآن (شاملًا الدخول الجزئي إن لم تكن الأسرة كلها قد وصلت بعد).
      </p>

      <AddGuestForm eventId={event.id} onAdded={() => refresh()} />
      <BulkUpload eventId={event.id} onDone={() => refresh()} />
      <SendInvitesButton eventId={event.id} guests={guests} onDone={() => refresh()} />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 card p-4 overflow-x-auto">
          <h2 className="font-bold mb-3">قائمة الضيوف</h2>
          <table className="w-full text-right">
            <thead>
              <tr className="text-xs text-gray-500 border-b" style={{ borderColor: "#f1e8d8" }}>
                <th className="py-2 px-2">الاسم</th>
                <th className="py-2 px-2">الرقم</th>
                <th className="py-2 px-2 text-center">إجمالي الحضور المسموح</th>
                <th className="py-2 px-2 text-center">الحالة</th>
                <th className="py-2 px-2 text-center">الدخول</th>
                <th className="py-2 px-2 text-center">الدعوة</th>
                <th className="py-2 px-2 text-center">الرابط</th>
                <th className="py-2 px-2 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <GuestRow key={g.id} guest={g} onDelete={deleteGuest} />
              ))}
              {guests.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">لا يوجد ضيوف مضافون بعد</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-6">
            <CheckinLogFeed logs={checkinLogs} />
          </div>
        </div>

        <div className="space-y-6">
          <WhatsappFeed messages={feed.messages} watiConfigured={feed.watiConfigured} />
          <WishWall guests={guests} />
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const refreshEvents = useCallback(async () => {
    const res = await fetch("/api/events");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const data = await res.json();
    setEvents(data.events);
    if (!selectedId && data.events.length > 0) setSelectedId(data.events[0].id);
  }, [selectedId]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  if (authed === null) {
    return <main className="min-h-screen flex items-center justify-center">جاري التحميل...</main>;
  }
  if (authed === false) {
    return <LoginForm onLoggedIn={refreshEvents} />;
  }

  const selectedEvent = events.find((e) => e.id === selectedId);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold-dark)" }}>لوحة إدارة Da3wa</h1>
        <button
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            setAuthed(false);
          }}
          className="text-sm text-gray-500 underline"
        >
          تسجيل خروج
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedId || ""}
          onChange={(e) => setSelectedId(e.target.value)}
          className="border rounded-lg px-3 py-2 outline-none"
          style={{ borderColor: "#eee0cc" }}
        >
          <option value="" disabled>اختر زفافًا</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.coupleNames} — {e.guestCount}/{e.packageLimit}</option>
          ))}
        </select>
        <button onClick={() => setShowCreate((v) => !v)} className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          {showCreate ? "إلغاء" : "+ زفاف جديد"}
        </button>
      </div>

      <TestWhatsappSend />

      {showCreate && (
        <CreateEventForm
          onCreated={(event) => {
            setShowCreate(false);
            setEvents((evs) => [event, ...evs]);
            setSelectedId(event.id);
          }}
        />
      )}

      {selectedEvent ? (
        <EventDashboard
          key={selectedEvent.id}
          event={selectedEvent}
          onDeleted={() => {
            setSelectedId(null);
            refreshEvents();
          }}
        />
      ) : (
        !showCreate && <p className="text-gray-500">لا توجد أعراس بعد — اضغط &quot;+ زفاف جديد&quot; للبدء</p>
      )}
    </main>
  );
}
