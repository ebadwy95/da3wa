"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function StatCard({ label, value, accent }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-3xl font-bold" style={{ color: accent || "var(--gold-dark)" }}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

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
      if (!res.ok) throw new Error(data.error || "تعذر إنشاء الفرح");
      onCreated(data.event);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-3 max-w-lg">
      <h2 className="font-bold text-lg">إنشاء فرح جديد</h2>
      <div>
        <label className="block text-xs text-gray-500 mb-1">رقم واتساب العريس (مطلوب — بيكون معرّف الفرح)</label>
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
          <label className="block text-xs text-gray-500 mb-1">تاريخ الفرح</label>
          <input
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            placeholder="مثلاً: 20 نوفمبر 2026"
            className="w-full border rounded-lg px-3 py-2 outline-none"
            style={{ borderColor: "#eee0cc" }}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">حد الباكدج (عدد الدعوات)</label>
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
        {saving ? "..." : "إنشاء الفرح"}
      </button>
    </form>
  );
}

function GuestRow({ guest, onDelete }) {
  const [copied, setCopied] = useState(false);
  const statusLabel = { pending: "لسه ماردش", confirmed: "أكد الحضور", declined: "اعتذر" }[guest.status];
  const statusColor = { pending: "#a08a5a", confirmed: "#2e7d32", declined: "#b3261e" }[guest.status];

  function copyLink() {
    navigator.clipboard.writeText(guest.inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <tr className="border-b last:border-0" style={{ borderColor: "#f1e8d8" }}>
      <td className="py-3 px-2 font-medium">{guest.name}</td>
      <td className="py-3 px-2 text-gray-500" dir="ltr">{guest.phoneDisplay || guest.phone}</td>
      <td className="py-3 px-2 text-center">{guest.maxCompanions}</td>
      <td className="py-3 px-2 text-center">
        <span style={{ color: statusColor }} className="font-semibold text-sm">{statusLabel}</span>
      </td>
      <td className="py-3 px-2 text-center">
        {guest.checkedIn ? <span className="text-green-700 font-semibold text-sm">✅ دخل</span> : <span className="text-gray-400 text-sm">—</span>}
      </td>
      <td className="py-3 px-2 text-center">
        {guest.invitedAt ? <span className="text-sm text-green-700">اتبعتلها</span> : <span className="text-sm text-gray-400">لسه</span>}
      </td>
      <td className="py-3 px-2 text-center whitespace-nowrap">
        <button onClick={copyLink} className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          {copied ? "اتنسخ ✓" : "نسخ الرابط"}
        </button>
      </td>
      <td className="py-3 px-2 text-center">
        <button onClick={() => onDelete(guest.id)} className="text-sm text-red-500 hover:underline">حذف</button>
      </td>
    </tr>
  );
}

function LimitReachedModal({ info, onForceAdd, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="card p-6 max-w-sm w-full space-y-4 text-center">
        <h3 className="font-bold text-lg">وصلت لحد الباكدج</h3>
        <p className="text-sm text-gray-600">
          الباكدج بتاع الفرح ده {info.packageLimit} دعوة، وعندك دلوقتي {info.guestCount} ضيف مضاف.
          تحب تعمل إيه؟
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onForceAdd} className="btn-gold py-2 rounded-lg font-semibold">
            ضيف الضيف ده برضو (زيادة عن الباكدج)
          </button>
          <a
            href="https://wa.me/?text=عايز%20أرفع%20الباكدج%20بتاع%20الفرح"
            target="_blank"
            rel="noreferrer"
            className="py-2 rounded-lg font-semibold border"
            style={{ borderColor: "#eee0cc" }}
          >
            كلم الإدارة عشان ترفّع الباكدج
          </a>
          <button onClick={onCancel} className="text-sm text-gray-400 underline mt-1">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function AddGuestForm({ eventId, onAdded }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [maxCompanions, setMaxCompanions] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [limitInfo, setLimitInfo] = useState(null);

  async function doSubmit(force) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, maxCompanions, force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.limitReached) {
        setLimitInfo(data);
        return;
      }
      if (!res.ok) throw new Error(data.error || "تعذرت الإضافة");
      onAdded(data.guest);
      setName("");
      setPhone("");
      setMaxCompanions(0);
      setLimitInfo(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {limitInfo && (
        <LimitReachedModal
          info={limitInfo}
          onCancel={() => setLimitInfo(null)}
          onForceAdd={() => {
            setLimitInfo(null);
            doSubmit(true);
          }}
        />
      )}
      <form onSubmit={(e) => { e.preventDefault(); doSubmit(false); }} className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">اسم الضيف</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border rounded-lg px-3 py-2 outline-none" style={{ borderColor: "#eee0cc" }} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">رقم الواتساب (مع كود الدولة)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" placeholder="+9665XXXXXXXX" className="w-full border rounded-lg px-3 py-2 outline-none" style={{ borderColor: "#eee0cc" }} />
        </div>
        <div className="w-28">
          <label className="block text-xs text-gray-500 mb-1">حد المرافقين</label>
          <input type="number" min={0} value={maxCompanions} onChange={(e) => setMaxCompanions(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none" style={{ borderColor: "#eee0cc" }} />
        </div>
        <button disabled={saving} className="btn-gold px-6 py-2 rounded-lg font-semibold">{saving ? "..." : "إضافة"}</button>
        {error && <p className="text-red-600 text-sm w-full">{error}</p>}
      </form>
    </>
  );
}

function BulkUpload({ eventId, onDone }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/events/${eventId}/guests/bulk`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر رفع الملف");
      setResult(data);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-bold">رفع شيت ضيوف دفعة واحدة</h2>
        <a href="/da3wa-guests-template.csv" download className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          تحميل نموذج الشيت
        </a>
      </div>
      <p className="text-xs text-gray-500">
        لازم الشيت يكون بنفس أعمدة النموذج وبنفس الترتيب بالظبط: الاسم، رقم الواتساب (مع كود الدولة)، عدد المرافقين.
        أي شيت بترتيب مختلف هيترفض.
      </p>
      <div className="flex gap-2 items-center flex-wrap">
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="text-sm" />
        <button onClick={upload} disabled={uploading} className="btn-gold px-4 py-2 rounded-lg text-sm font-semibold">
          {uploading ? "جاري الرفع..." : "رفع الشيت"}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {result && (
        <div className="text-sm space-y-1 border-t pt-2" style={{ borderColor: "#f1e8d8" }}>
          <p className="text-green-700 font-semibold">تمت إضافة {result.added} ضيف من أصل {result.totalRowsInFile}</p>
          {result.errors?.length > 0 && (
            <div className="text-amber-700">
              <p className="font-semibold">{result.errors.length} صف اتخطى:</p>
              <ul className="list-disc mr-5 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i}>صف {e.row}: {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SendInvitesButton({ eventId, guests, onDone }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const notYetInvited = guests.filter((g) => !g.invitedAt).length;

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/events/${eventId}/guests/send-invites`, { method: "POST" });
      const data = await res.json();
      setResult(data);
      onDone();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="font-bold">إرسال روابط الدعوة</h2>
        <p className="text-xs text-gray-500">{notYetInvited} ضيف لسه ماوصلهوش رابط الدعوة</p>
        {result && <p className="text-xs mt-1 text-green-700">اترسل لـ {result.sent} — فشل {result.failed}</p>}
      </div>
      <button
        onClick={send}
        disabled={sending || notYetInvited === 0}
        className="btn-gold px-6 py-2 rounded-lg font-semibold"
      >
        {sending ? "جاري الإرسال..." : `ابعت الدعوات (${notYetInvited})`}
      </button>
    </div>
  );
}

function WhatsappFeed({ messages, watiConfigured }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">فيد رسائل واتساب</h2>
        <span
          className="text-xs px-2 py-1 rounded-full font-semibold"
          style={{ background: watiConfigured ? "#e6f4ea" : "#fdecea", color: watiConfigured ? "#2e7d32" : "#b3261e" }}
        >
          {watiConfigured ? "متصل بـ Wati — إرسال حقيقي" : "غير متصل — محاكاة فقط"}
        </span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-6">لسه مفيش رسائل</p>}
        {messages.map((m) => (
          <div key={m.id} className="border rounded-lg p-3 text-sm" style={{ borderColor: "#f1e8d8" }}>
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium">{m.content}</span>
              <span
                className="text-xs shrink-0 px-2 py-0.5 rounded-full"
                style={{
                  background: m.status === "sent" ? "#e6f4ea" : m.status === "failed" ? "#fdecea" : "#fff4de",
                  color: m.status === "sent" ? "#2e7d32" : m.status === "failed" ? "#b3261e" : "#a08a2d",
                }}
              >
                {{ sent: "اترسلت فعلاً", simulated: "محاكاة", failed: "فشلت", logged: "مسجّلة" }[m.status]}
              </span>
            </div>
            {m.error && <p className="text-red-500 text-xs mt-1">{m.error}</p>}
            <p className="text-gray-400 text-xs mt-1">{new Date(m.createdAt).toLocaleString("ar-EG")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventDashboard({ event, onDeleted }) {
  const [stats, setStats] = useState(null);
  const [guests, setGuests] = useState([]);
  const [feed, setFeed] = useState({ messages: [], watiConfigured: false });

  const refresh = useCallback(async () => {
    const [statsRes, guestsRes, feedRes] = await Promise.all([
      fetch(`/api/stats?eventId=${event.id}`),
      fetch(`/api/events/${event.id}/guests`),
      fetch(`/api/whatsapp/feed?eventId=${event.id}`),
    ]);
    setStats((await statsRes.json()).stats);
    setGuests((await guestsRes.json()).guests);
    setFeed(await feedRes.json());
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
            {event.groomPhoneDisplay} — الباكدج: {event.packageLimit} دعوة
          </p>
        </div>
        <button
          onClick={async () => {
            await fetch(`/api/events/${event.id}`, { method: "DELETE" });
            onDeleted();
          }}
          className="text-sm text-red-500 underline"
        >
          حذف الفرح
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="مدعوين" value={stats.invited} />
          <StatCard label="أكدوا" value={stats.confirmed} accent="#2e7d32" />
          <StatCard label="لسه ماردوش" value={stats.pending} accent="#a08a5a" />
          <StatCard label="اعتذروا" value={stats.declined} accent="#b3261e" />
          <StatCard label="دخلوا فعلاً" value={stats.checkedIn} accent="#1a73e8" />
        </div>
      )}

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
                <th className="py-2 px-2 text-center">حد المرافقين</th>
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
                  <td colSpan={8} className="text-center text-gray-400 py-8">لسه مفيش ضيوف مضافين</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <WhatsappFeed messages={feed.messages} watiConfigured={feed.watiConfigured} />
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
          <option value="" disabled>اختار فرح</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.coupleNames} — {e.guestCount}/{e.packageLimit}</option>
          ))}
        </select>
        <button onClick={() => setShowCreate((v) => !v)} className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          {showCreate ? "إلغاء" : "+ فرح جديد"}
        </button>
      </div>

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
        !showCreate && <p className="text-gray-500">لسه مفيش أفراح — دوس &quot;+ فرح جديد&quot; عشان تبدأ</p>
      )}
    </main>
  );
}
