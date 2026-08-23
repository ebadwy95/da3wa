"use client";

import { useCallback, useEffect, useState } from "react";
import {
  StatCard,
  GuestRow,
  AddGuestForm,
  BulkUpload,
  SendInvitesButton,
  WhatsappFeed,
  CheckinLogFeed,
  WishWall,
} from "@/components/dashboardWidgets";
import { formatEventDateArabic } from "@/lib/date";

function LoginForm({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/couple-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ في تسجيل الدخول");
      onLoggedIn(data.event, data.mustChangePassword);
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
          دخول العروسين
        </h1>
        <p className="text-xs text-gray-500">
          استخدما اسم المستخدم وكلمة المرور اللذين وصلاكما من الإدارة.
        </p>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="اسم المستخدم"
          dir="ltr"
          className="w-full border rounded-lg px-4 py-3 text-center outline-none focus:ring-2"
          style={{ borderColor: "#eee0cc" }}
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          dir="ltr"
          className="w-full border rounded-lg px-4 py-3 text-center outline-none focus:ring-2"
          style={{ borderColor: "#eee0cc" }}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="pill-btn w-full"
        >
          {loading ? "جاري الدخول..." : "تسجيل الدخول"}
        </button>
      </form>
    </main>
  );
}

function ChangePasswordForm({ onChanged }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 4) {
      setError("يجب أن تتكوّن كلمة المرور الجديدة من 4 حروف/أرقام على الأقل");
      return;
    }
    if (newPassword !== confirm) {
      setError("كلمة المرور وتأكيدها غير متطابقتين");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/couple-auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر تغيير كلمة المرور");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card max-w-sm w-full p-8 space-y-4 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold-dark)" }}>
          مطلوب تغيير كلمة المرور
        </h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          هذه أول مرة تدخلان فيها (أو تم إعادة تعيين كلمة المرور من الإدارة) —
          يجب اختيار كلمة مرور جديدة خاصة بكما قبل المتابعة إلى لوحة زفافكما.
        </p>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="كلمة المرور الجديدة"
          dir="ltr"
          className="w-full border rounded-lg px-4 py-3 text-center outline-none focus:ring-2"
          style={{ borderColor: "#eee0cc" }}
          autoFocus
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="تأكيد كلمة المرور الجديدة"
          dir="ltr"
          className="w-full border rounded-lg px-4 py-3 text-center outline-none focus:ring-2"
          style={{ borderColor: "#eee0cc" }}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving || !newPassword || !confirm}
          className="pill-btn w-full"
        >
          {saving ? "جاري الحفظ..." : "حفظ كلمة المرور والمتابعة"}
        </button>
      </form>
    </main>
  );
}

function CoupleDashboard({ eventId, onLoggedOut }) {
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState(null);
  const [guests, setGuests] = useState([]);
  const [feed, setFeed] = useState({ messages: [], watiConfigured: false });
  const [checkinLogs, setCheckinLogs] = useState([]);

  const refresh = useCallback(async () => {
    const [eventRes, statsRes, guestsRes, feedRes, logsRes] = await Promise.all([
      fetch(`/api/events/${eventId}`),
      fetch(`/api/stats?eventId=${eventId}`),
      fetch(`/api/events/${eventId}/guests`),
      fetch(`/api/whatsapp/feed?eventId=${eventId}`),
      fetch(`/api/events/${eventId}/checkin-logs`),
    ]);
    setEvent((await eventRes.json()).event);
    setStats((await statsRes.json()).stats);
    setGuests((await guestsRes.json()).guests);
    setFeed(await feedRes.json());
    setCheckinLogs((await logsRes.json()).logs || []);
  }, [eventId]);

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
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--gold-dark)" }}>
            {event ? event.coupleNames : "لوحة زفافكما"}
          </h1>
          {event && (
            <p className="text-xs text-gray-500">
              الباقة: {event.packageLimit} دعوة
              {formatEventDateArabic(event.eventDate) ? ` — ${formatEventDateArabic(event.eventDate)}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={async () => {
            await fetch("/api/couple-auth", { method: "DELETE" });
            onLoggedOut();
          }}
          className="text-sm text-gray-500 underline"
        >
          تسجيل خروج
        </button>
      </div>

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
        كل ضيف مؤكَّد زائد عدد مرافقيه الذين أكّدهم فعليًا. &quot;دخلوا فعلًا&quot; = عدد الأفراد الذين دخلوا فعليًا عند
        الباب حتى الآن (شاملًا الدخول الجزئي).
      </p>

      <AddGuestForm eventId={eventId} onAdded={() => refresh()} />
      <BulkUpload eventId={eventId} onDone={() => refresh()} />
      <SendInvitesButton eventId={eventId} guests={guests} onDone={() => refresh()} />

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
    </main>
  );
}

export default function CouplePage() {
  const [status, setStatus] = useState("loading"); // loading | login | changePassword | dashboard
  const [eventId, setEventId] = useState(null);

  const checkSession = useCallback(async () => {
    const res = await fetch("/api/couple-auth");
    const data = await res.json();
    if (!data.authed) {
      setStatus("login");
      return;
    }
    setEventId(data.event.id);
    setStatus(data.mustChangePassword ? "changePassword" : "dashboard");
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (status === "loading") {
    return <main className="min-h-screen flex items-center justify-center">جاري التحميل...</main>;
  }

  if (status === "login") {
    return (
      <LoginForm
        onLoggedIn={(event, mustChangePassword) => {
          setEventId(event.id);
          setStatus(mustChangePassword ? "changePassword" : "dashboard");
        }}
      />
    );
  }

  if (status === "changePassword") {
    return <ChangePasswordForm onChanged={() => setStatus("dashboard")} />;
  }

  return <CoupleDashboard eventId={eventId} onLoggedOut={() => setStatus("login")} />;
}
