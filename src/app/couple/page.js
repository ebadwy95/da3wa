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
import { LoginScreen, DashboardHeader } from "@/components/dashboardChrome";

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
    <LoginScreen
      title="لوحة مناسبتكما"
      hint="استخدما اسم المستخدم وكلمة المرور اللذين وصلاكما من الإدارة."
      error={error}
      loading={loading}
      onSubmit={submit}
    >
      <div className="text-right">
        <label htmlFor="couple-user" className="label">اسم المستخدم</label>
        <input
          id="couple-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          dir="ltr"
          className="field text-center"
          autoFocus
        />
      </div>
      <div className="text-right">
        <label htmlFor="couple-pw" className="label">كلمة المرور</label>
        <input
          id="couple-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          dir="ltr"
          className="field text-center"
          aria-invalid={error ? "true" : undefined}
        />
      </div>
    </LoginScreen>
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
        <h1 className="text-2xl font-bold" style={{ color: "var(--gold-600)" }}>
          مطلوب تغيير كلمة المرور
        </h1>
        <p className="text-xs text-ink-2 leading-relaxed">
          هذه أول مرة تدخلان فيها (أو تم إعادة تعيين كلمة المرور من الإدارة) —
          يجب اختيار كلمة مرور جديدة خاصة بكما قبل المتابعة إلى لوحة زفافكما.
        </p>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="كلمة المرور الجديدة"
          dir="ltr"
          className="field text-center"
          autoFocus
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="تأكيد كلمة المرور الجديدة"
          dir="ltr"
          className="field text-center"
        />
        {error && <p className="text-danger text-sm">{error}</p>}
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
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <DashboardHeader
        title={event ? event.coupleNames : "لوحة مناسبتكما"}
        subtitle={
          event
            ? `الباقة: ${event.packageLimit} دعوة${
                formatEventDateArabic(event.eventDate) ? ` — ${formatEventDateArabic(event.eventDate)}` : ""
              }`
            : undefined
        }
        onLogout={async () => {
          await fetch("/api/couple-auth", { method: "DELETE" });
          onLoggedOut();
        }}
      />

      <div className="wrap p-5 flex flex-col gap-6" style={{ maxWidth: "80rem" }}>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="إجمالي الدعوات" value={stats.invited} />
          <StatCard label="أكدوا" value={stats.confirmed} accent="var(--ok)" />
          <StatCard label="لم يردّوا بعد" value={stats.pending} accent="var(--gold-600)" />
          <StatCard label="اعتذروا" value={stats.declined} accent="var(--danger)" />
          <StatCard label="إجمالي الحضور المتوقع" value={stats.expectedAttendees} accent="var(--info)" />
          <StatCard label="دخلوا فعلاً (عدد الأفراد)" value={stats.peopleCheckedIn} accent="var(--info)" />
        </div>
      )}
      <p className="text-xs text-ink-3 -mt-3">
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
              <tr className="text-xs text-ink-2 border-b" style={{ borderColor: "var(--line-soft)" }}>
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
                  <td colSpan={8} className="text-center text-ink-3 py-8">لا يوجد ضيوف مضافون بعد</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-6">
            <CheckinLogFeed logs={checkinLogs} />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <WhatsappFeed messages={feed.messages} watiConfigured={feed.watiConfigured} />
          <WishWall guests={guests} />
        </div>
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
