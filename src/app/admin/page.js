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
import { WrenchIcon, ChevronDownIcon, VideoIcon, MusicIcon, ImageIcon, PaletteIcon } from "@/components/icons";
import { formatEventDateArabic, formatEventTimeArabic } from "@/lib/date";
import { joinCoupleNames, resolveCoupleParts } from "@/lib/couple";
import { LoginScreen, DashboardHeader } from "@/components/dashboardChrome";
import { EnquiriesInbox } from "@/components/EnquiriesInbox";

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
    <LoginScreen
      title="لوحة الإدارة"
      hint="الدخول لمسؤول المنصّة."
      error={error}
      loading={loading}
      onSubmit={submit}
    >
      <div className="text-right">
        <label htmlFor="admin-pw" className="label">كلمة المرور</label>
        <input
          id="admin-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field text-center"
          aria-invalid={error ? "true" : undefined}
          autoFocus
        />
      </div>
    </LoginScreen>
  );
}

// Shows the exact phrase the two name fields produce — the same string the
// invitation renders and the same one da3wa_invite_link builds from
// {{groom}} and {{bride}}. Cheap to show, and it's the difference between an
// admin trusting the split and guessing at it.
function CoupleNamePreview({ groomName, brideName }) {
  const joined = joinCoupleNames(groomName, brideName);
  if (!joined) return null;
  return (
    <p className="hint">
      سيظهر للضيوف باسم: <strong style={{ color: "var(--gold-600)" }}>{joined}</strong>
    </p>
  );
}

// The invitation's film, music, poster and colour. Shared by the create and
// edit forms so a wedding set up in either place offers the same options.
//
// URLs rather than uploads: the film is produced by whoever designs it and
// already lives somewhere, so the platform doesn't take on hosting large
// media. Any direct link works — Vercel Blob, Supabase, S3 — as long as it
// points at the file itself and not a preview page.
function InviteMediaFields({ form, setForm }) {
  return (
    <div className="flex flex-col gap-3 pt-4" style={{ borderTop: "1px solid var(--line-soft)" }}>
      <h3 className="font-bold text-sm flex items-center gap-2">
        <VideoIcon size={16} />
        الافتتاحية والموسيقى (اختياري)
      </h3>
      <p className="hint m-0">
        لو أضفت فيديو أو موسيقى، هتفتح الدعوة بشاشة كاملة يضغط عليها الضيف
        لتشغيلها — الضغطة مطلوبة لأن المتصفحات تمنع تشغيل الصوت تلقائيًا.
        استخدم روابط مباشرة للملفات، ويفضّل فيديو رأسي 9:16.
      </p>

      <div>
        <label className="label flex items-center gap-2">
          <VideoIcon size={15} />
          رابط الفيديو (mp4)
        </label>
        <input
          value={form.inviteVideoUrl}
          onChange={(e) => setForm({ ...form, inviteVideoUrl: e.target.value })}
          dir="ltr"
          placeholder="https://.../invite.mp4"
          className="field"
        />
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <ImageIcon size={15} />
          صورة الغلاف (تظهر قبل تشغيل الفيديو)
        </label>
        <input
          value={form.invitePosterUrl}
          onChange={(e) => setForm({ ...form, invitePosterUrl: e.target.value })}
          dir="ltr"
          placeholder="https://.../poster.jpg"
          className="field"
        />
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <MusicIcon size={15} />
          رابط الموسيقى (mp3)
        </label>
        <input
          value={form.inviteAudioUrl}
          onChange={(e) => setForm({ ...form, inviteAudioUrl: e.target.value })}
          dir="ltr"
          placeholder="https://.../music.mp3"
          className="field"
        />
        <p className="hint">
          تأكّد من حقوق استخدام الموسيقى — أغاني الفنانين محمية، والدعوة صفحة
          عامة على الإنترنت.
        </p>
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <PaletteIcon size={15} />
          مظهر الدعوة
        </label>
        <div className="tab-switch">
          <button
            type="button"
            data-active={form.inviteTheme !== "dark"}
            onClick={() => setForm({ ...form, inviteTheme: "light" })}
          >
            كريمي وذهبي
          </button>
          <button
            type="button"
            data-active={form.inviteTheme === "dark"}
            onClick={() => setForm({ ...form, inviteTheme: "dark" })}
          >
            غامق فاخر
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateEventForm({ onCreated }) {
  const [form, setForm] = useState({
    groomPhone: "",
    groomName: "",
    brideName: "",
    eventDate: "",
    eventTime: "",
    venueName: "",
    packageLimit: 100,
    inviteVideoUrl: "",
    invitePosterUrl: "",
    inviteAudioUrl: "",
    inviteTheme: "light",
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
        <label className="label">رقم واتساب العريس (مطلوب — يكون معرّف الزفاف)</label>
        <input
          value={form.groomPhone}
          onChange={(e) => setForm({ ...form, groomPhone: e.target.value })}
          dir="ltr"
          placeholder="+965XXXXXXXX"
          required
          className="field"
        />
      </div>
      {/* Two fields rather than one: the WhatsApp templates take {{groom}}
          and {{bride}} as separate variables and join them themselves. The
          preview underneath shows the phrase guests will actually read, so
          the split never feels abstract. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">اسم العريس</label>
          <input
            value={form.groomName}
            onChange={(e) => setForm({ ...form, groomName: e.target.value })}
            required
            className="field"
          />
        </div>
        <div>
          <label className="label">اسم العروسة</label>
          <input
            value={form.brideName}
            onChange={(e) => setForm({ ...form, brideName: e.target.value })}
            required
            className="field"
          />
        </div>
      </div>
      <CoupleNamePreview groomName={form.groomName} brideName={form.brideName} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">تاريخ الزفاف</label>
          <input
            type="date"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            className="field"
          />
        </div>
        <div>
          <label className="label">وقت الحفل</label>
          <input
            type="time"
            value={form.eventTime}
            onChange={(e) => setForm({ ...form, eventTime: e.target.value })}
            className="field"
          />
        </div>
      </div>
      <div>
        <label className="label">الحد الأقصى للباقة (عدد الدعوات)</label>
        <input
          type="number"
          min={1}
          value={form.packageLimit}
          onChange={(e) => setForm({ ...form, packageLimit: e.target.value })}
          className="field"
        />
      </div>
      <div>
        <label className="label">اسم القاعة (اختياري)</label>
        <input
          value={form.venueName}
          onChange={(e) => setForm({ ...form, venueName: e.target.value })}
          className="field"
        />
      </div>
      <InviteMediaFields form={form} setForm={setForm} />
      {error && <p className="text-danger text-sm">{error}</p>}
      <button disabled={saving} className="pill-btn px-6">
        {saving ? "..." : "إنشاء الزفاف"}
      </button>
    </form>
  );
}

function EditEventForm({ event, onUpdated, onClose }) {
  // For weddings created before the names were split, the server filled these
  // in by splitting the joined name. That guess shows up here as ordinary
  // editable text so it gets checked by a human before any message goes out.
  const initialParts = resolveCoupleParts(event);
  const [form, setForm] = useState({
    groomName: initialParts.groomName,
    brideName: initialParts.brideName,
    eventDate: event.eventDate || "",
    eventTime: event.eventTime || "",
    venueName: event.venueName || "",
    venueAddress: event.venueAddress || "",
    venueMapUrl: event.venueMapUrl || "",
    welcomeMessage: event.welcomeMessage || "",
    packageLimit: event.packageLimit || 100,
    inviteVideoUrl: event.inviteVideoUrl || "",
    invitePosterUrl: event.invitePosterUrl || "",
    inviteAudioUrl: event.inviteAudioUrl || "",
    inviteTheme: event.inviteTheme === "dark" ? "dark" : "light",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر حفظ التعديلات");
      onUpdated(data.event);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">تعديل تفاصيل الزفاف</h2>
        <button type="button" onClick={onClose} className="pill-btn-ghost pill-btn-sm">إغلاق</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">اسم العريس</label>
          <input
            value={form.groomName}
            onChange={(e) => setForm({ ...form, groomName: e.target.value })}
            required
            className="field"
          />
        </div>
        <div>
          <label className="label">اسم العروسة</label>
          <input
            value={form.brideName}
            onChange={(e) => setForm({ ...form, brideName: e.target.value })}
            required
            className="field"
          />
        </div>
      </div>
      <CoupleNamePreview groomName={form.groomName} brideName={form.brideName} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">تاريخ الزفاف</label>
          <input
            type="date"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            className="field"
          />
        </div>
        <div>
          <label className="label">وقت الحفل</label>
          <input
            type="time"
            value={form.eventTime}
            onChange={(e) => setForm({ ...form, eventTime: e.target.value })}
            className="field"
          />
        </div>
      </div>
      <div>
        <label className="label">الحد الأقصى للباقة (عدد الدعوات)</label>
        <input
          type="number"
          min={1}
          value={form.packageLimit}
          onChange={(e) => setForm({ ...form, packageLimit: e.target.value })}
          className="field"
        />
      </div>
      <div>
        <label className="label">اسم القاعة</label>
        <input
          value={form.venueName}
          onChange={(e) => setForm({ ...form, venueName: e.target.value })}
          className="field"
        />
      </div>
      <div>
        <label className="label">رابط الموقع على الخريطة (اختياري)</label>
        <input
          value={form.venueMapUrl}
          onChange={(e) => setForm({ ...form, venueMapUrl: e.target.value })}
          dir="ltr"
          className="field"
        />
      </div>
      <div>
        <label className="label">رسالة الترحيب التي يراها الضيف</label>
        <textarea
          value={form.welcomeMessage}
          onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
          rows={3}
          className="field"
        />
      </div>
      <InviteMediaFields form={form} setForm={setForm} />
      {error && <p className="text-danger text-sm">{error}</p>}
      <button disabled={saving} className="pill-btn px-6">{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
    </form>
  );
}

function TestWhatsappSend() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("رسالة تجربة من نظام Da3wa");
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
    <div className="space-y-3">
      <p className="text-xs text-ink-2 leading-relaxed">
        هذا الإرسال لا يحتاج قالبًا معتمدًا من ميتا، لكنه يعمل فقط ضمن نافذة
        الأربع وعشرين ساعة التي تفتحها واتساب بعد أن يراسل الرقم المطلوب
        اختباره رقم النشاط التجاري المتصل أولًا. إن لم يكن الرقم قد راسل
        النشاط التجاري خلال آخر أربع وعشرين ساعة، سيفشل الإرسال مهما كان
        الرمز صحيحًا — هذا قيد من سياسة واتساب نفسها وليس خللًا في النظام.
      </p>
      <form onSubmit={send} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="label">الرقم (مع كود الدولة)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            placeholder="+9665XXXXXXXX"
            required
            className="field"
          />
        </div>
        <div className="flex-[2] min-w-[220px]">
          <label className="label">نص الرسالة</label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="field"
          />
        </div>
        <button disabled={sending} className="pill-btn px-6">
          {sending ? "جاري الإرسال..." : "إرسال تجريبي"}
        </button>
      </form>
      {result && (
        <div
          className="text-sm rounded-lg p-3 space-y-2"
          style={{
            background: result.error ? "var(--danger-bg)" : result.simulated ? "var(--warn-bg)" : "var(--ok-bg)",
            color: result.error ? "var(--danger)" : result.simulated ? "var(--warn)" : "var(--ok)",
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

function TechnicalToolsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-ink-2"
      >
        <span className="flex items-center gap-2"><WrenchIcon size={16} />أدوات تقنية للمطوّر</span>
        <span className="flex items-center gap-1 text-xs">{open ? "إخفاء" : "إظهار"}<ChevronDownIcon size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} /></span>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t flex flex-col gap-5" style={{ borderColor: "var(--line-soft)" }}>
          <WhatsappDiagnostics />
          <div>
            <h2 className="font-bold mb-2">تجربة إرسال واتساب (بدون قالب معتمد)</h2>
            <TestWhatsappSend />
          </div>
        </div>
      )}
    </div>
  );
}

// Shows what THIS deployment is configured with, checked against the live
// Wati account. Added because a failed send used to give only a raw API error
// per guest, while the answer — which template name the deployment holds —
// was only visible in the hosting dashboard.
function WhatsappDiagnostics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Split so the mount path never sets state synchronously inside the effect —
  // it starts already loading, and only the promise callbacks update state.
  // The refresh button goes through `load`, where setLoading is a real event.
  const fetchDiagnostics = useCallback(
    () =>
      fetch("/api/whatsapp/diagnostics")
        .then((res) => res.json())
        .then(setData)
        .catch(() => setData({ error: "تعذّر قراءة الإعدادات" }))
        .finally(() => setLoading(false)),
    []
  );

  const load = useCallback(() => {
    setLoading(true);
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  if (loading && !data) return <p className="meta">جارٍ قراءة الإعدادات...</p>;
  if (!data || data.error) return <p className="error">{data?.error || "تعذّر قراءة الإعدادات"}</p>;

  const rows = [
    {
      label: "الاتصال بـ Wati",
      value: data.watiConfigured ? "متصل" : "غير مضبوط",
      ok: data.watiConfigured,
      problem: data.accountError,
    },
    {
      label: "رابط الموقع",
      value: data.baseUrl.value || "—",
      ok: data.baseUrl.ok,
      problem: data.baseUrl.problem,
      ltr: true,
    },
    ...data.templates.map((t) => ({
      label: t.label,
      value: t.value || "—",
      ok: t.ok,
      problem: t.problem,
      hint: t.status ? `الحالة: ${t.status}` : null,
      ltr: true,
    })),
  ];

  if (data.channelNumber) {
    rows.push({
      label: "رقم القناة",
      value: data.channelNumber,
      ok: false,
      problem: "مضبوط — امسحه إن كان لحسابك رقم واتساب واحد فقط",
      ltr: true,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="font-bold">حالة إعدادات واتساب</h2>
        <button onClick={load} className="pill-btn-ghost pill-btn-sm" disabled={loading}>
          {loading ? "..." : "تحديث"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="card-flat px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" style={{ minWidth: "7.5rem" }}>
              {r.label}
            </span>
            <span
              className={`text-sm ${r.ltr ? "ltr text-left" : ""}`}
              style={{ color: "var(--ink-2)", wordBreak: "break-all", flex: 1 }}
            >
              {r.value}
            </span>
            <span className={`chip ${r.ok ? "chip-ok" : "chip-danger"}`}>
              {r.ok ? "سليم" : "يحتاج ضبط"}
            </span>
            {r.problem && <p className="error w-full m-0">{r.problem}</p>}
            {r.ok && r.hint && <p className="hint w-full m-0">{r.hint}</p>}
          </div>
        ))}
      </div>

      {data.approvedTemplates.length > 0 && (
        <p className="hint mt-2">
          القوالب المعتمدة في حسابك الآن:{" "}
          <span className="ltr">
            {data.approvedTemplates.map((t) => `${t.name} (${t.params.join(", ")})`).join(" · ")}
          </span>
        </p>
      )}
    </div>
  );
}

function ScannerAccessCard({ event, onUpdated }) {
  const [copied, setCopied] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const scanners = event.scanners || [];

  const scanLink =
    typeof window !== "undefined" ? `${window.location.origin}/scan` : "/scan";

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function addScanner() {
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}/scanners`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّرت إضافة سكانر");
      onUpdated(data.scanners);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function renameScanner(scannerId, name) {
    const res = await fetch(`/api/events/${event.id}/scanners/${scannerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) onUpdated(data.scanners);
  }

  async function removeScanner(scannerId) {
    const res = await fetch(`/api/events/${event.id}/scanners/${scannerId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) onUpdated(data.scanners);
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-bold">دخول سكانر الباب لهذا الزفاف</h2>
      <p className="text-xs text-ink-2 leading-relaxed">
        سلّم رابط الماسح لكل موظف استقبال عند الباب، مع الرمز الخاص به. اكتب
        اسم الموظف بنفسك أمام كل رمز — موظف الأمن لا يكتب اسمه بنفسه عند
        الدخول، بل يُدخل الرمز فقط، والاسم المسجَّل هنا هو ما يُنسب إليه في
        سجلّ الدخول تلقائيًا؛ هذا يمنع أي موظف من الدخول باسم زميل آخر. يمكن
        إضافة أكثر من رمز إذا كان أكثر من شخص سيقوم بالمسح في الزفاف نفسه.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="field flex-1 min-w-[160px]" dir="ltr">
          {scanLink}
        </div>
        <button onClick={() => copy(scanLink, "link")} className="pill-btn-outline pill-btn-sm">
          {copied === "link" ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
      </div>

      <div className="space-y-2">
        {scanners.map((s) => (
          <div key={s.id} className="flex flex-wrap gap-2 items-center border rounded-lg p-2" style={{ borderColor: "var(--line-soft)" }}>
            <div className="field font-mono tracking-widest" dir="ltr">
              {s.code}
            </div>
            <button onClick={() => copy(s.code, s.id)} className="pill-btn-ghost pill-btn-sm" style={{ color: "var(--gold-600)" }}>
              {copied === s.id ? "تم النسخ ✓" : "نسخ"}
            </button>
            <input
              defaultValue={s.name}
              placeholder="اسم موظف الأمن المخصَّص لهذا الرمز"
              onBlur={(e) => renameScanner(s.id, e.target.value)}
              className="field flex-1 min-w-[140px]"
            />
            {!s.name && (
              <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                بلا اسم — لن يعمل حتى تُدخل اسمًا
              </span>
            )}
            <button onClick={() => removeScanner(s.id)} className="pill-btn-danger pill-btn-sm">حذف</button>
          </div>
        ))}
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button onClick={addScanner} disabled={adding} className="pill-btn-outline text-sm">
        {adding ? "..." : "+ إضافة سكانر"}
      </button>
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
      <p className="text-xs text-ink-2 leading-relaxed">
        سلّم رابط الدخول واسم المستخدم وكلمة المرور هذه للعروسين، وسيَريان بها
        بيانات زفافهما فقط. عند أول دخول (أو بعد أي إعادة تعيين لكلمة المرور)
        سيُطلب منهما تغيير كلمة المرور قبل المتابعة. إن نسيا كلمة المرور، اضغط
        &quot;إعادة تعيين كلمة المرور&quot; لعرض كلمة مرور جديدة لهما من هنا.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="field flex-1 min-w-[160px]" dir="ltr">
          {coupleLink}
        </div>
        <button onClick={() => copy(coupleLink, "link")} className="pill-btn-outline pill-btn-sm">
          {copied === "link" ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="field font-mono" dir="ltr">
          {event.coupleUsername || "..."}
        </div>
        <button
          onClick={() => copy(event.coupleUsername || "", "username")}
          disabled={!event.coupleUsername}
          className="pill-btn-outline pill-btn-sm"
          style={{ color: "var(--gold-600)" }}
        >
          {copied === "username" ? "تم النسخ ✓" : "نسخ اسم المستخدم"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="field font-mono tracking-widest" dir="ltr">
          {event.couplePassword || "..."}
        </div>
        <button
          onClick={() => copy(event.couplePassword || "", "password")}
          disabled={!event.couplePassword}
          className="pill-btn-outline pill-btn-sm"
          style={{ color: "var(--gold-600)" }}
        >
          {copied === "password" ? "تم النسخ ✓" : "نسخ كلمة المرور"}
        </button>
        {event.mustChangePassword && (
          <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
            مطلوب تغييرها عند الدخول
          </span>
        )}
      </div>
      <button
        onClick={resetPassword}
        disabled={resetting}
        className="pill-btn-danger pill-btn-sm"
      >
        {resetting ? "جاري إعادة التعيين..." : "إعادة تعيين كلمة المرور"}
      </button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}

function ArchiveList({ events, onOpen, onRecalled }) {
  const [recallingId, setRecallingId] = useState(null);
  const [errors, setErrors] = useState({});

  const dateArchived = events.filter((e) => e.displayStatus === "archived");
  const deleted = events.filter((e) => e.displayStatus === "deleted");

  async function recall(id) {
    setRecallingId(id);
    setErrors((e) => ({ ...e, [id]: null }));
    try {
      const res = await fetch(`/api/events/${id}/recall`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر الاسترجاع");
      onRecalled();
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err.message }));
    } finally {
      setRecallingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold mb-2">أعراس اكتملت (مضى على تاريخها أكثر من 3 أيام)</h2>
        {dateArchived.length === 0 && <p className="text-sm text-ink-3">لا يوجد شيء هنا</p>}
        <div className="space-y-2">
          {dateArchived.map((e) => (
            <button
              key={e.id}
              onClick={() => onOpen(e.id)}
              className="card p-3 w-full text-right flex items-center justify-between"
            >
              <span>{e.coupleNames}</span>
              <span className="text-xs text-ink-3">{formatEventDateArabic(e.eventDate) || e.eventDate}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold mb-2">أعراس محذوفة (قابلة للاسترجاع لمدة 30 يومًا)</h2>
        {deleted.length === 0 && <p className="text-sm text-ink-3">لا يوجد شيء هنا</p>}
        <div className="space-y-2">
          {deleted.map((e) => (
            <div key={e.id} className="card p-3 space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span>{e.coupleNames}</span>
                <button
                  onClick={() => recall(e.id)}
                  disabled={recallingId === e.id}
                  className="pill-btn-outline text-xs"
                >
                  {recallingId === e.id ? "..." : "استرجاع"}
                </button>
              </div>
              {errors[e.id] && <p className="text-danger text-xs">{errors[e.id]}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventDashboard({ event, onDeleted, onUpdated }) {
  const [stats, setStats] = useState(null);
  const [guests, setGuests] = useState([]);
  const [feed, setFeed] = useState({ messages: [], watiConfigured: false });
  const [checkinLogs, setCheckinLogs] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [showEdit, setShowEdit] = useState(false);
  const eventForDisplay = { ...event, ...overrides };

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

  const prettyDate = formatEventDateArabic(eventForDisplay.eventDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">{eventForDisplay.coupleNames}</h2>
          <p className="text-xs text-ink-2" dir="ltr">
            {eventForDisplay.groomPhoneDisplay} — الباقة: {eventForDisplay.packageLimit} دعوة
            {prettyDate ? ` — ${prettyDate}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowEdit((v) => !v)} className="pill-btn-outline pill-btn-sm">
            {showEdit ? "إلغاء التعديل" : "تعديل تفاصيل الزفاف"}
          </button>
          <button
            onClick={async () => {
              await fetch(`/api/events/${event.id}`, { method: "DELETE" });
              onDeleted();
            }}
            className="pill-btn-danger pill-btn-sm"
          >
            حذف الزفاف
          </button>
        </div>
      </div>

      {showEdit && (
        <EditEventForm
          event={eventForDisplay}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            setOverrides((prev) => ({ ...prev, ...updated }));
            onUpdated(updated);
          }}
        />
      )}

      <ScannerAccessCard event={eventForDisplay} onUpdated={(scanners) => setOverrides((prev) => ({ ...prev, scanners }))} />
      <CoupleCredentialsCard event={eventForDisplay} onUpdated={(patch) => setOverrides((prev) => ({ ...prev, ...patch }))} />

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
        كل ضيف مؤكَّد زائد عدد مرافقيه الذين أكّدهم فعليًا. &quot;دخلوا فعلًا&quot; = عدد الأفراد الذين سُجِّل دخولهم فعليًا
        عند الباب حتى الآن (شاملًا الدخول الجزئي إن لم تكن الأسرة كلها قد وصلت بعد).
      </p>

      <AddGuestForm eventId={event.id} onAdded={() => refresh()} />
      <BulkUpload eventId={event.id} onDone={() => refresh()} />
      <SendInvitesButton eventId={event.id} guests={guests} onDone={() => refresh()} />

      {/* The guest table and the feeds used to share one row, three columns
          wide, which left the feeds about a third of the page — too narrow for
          a WhatsApp API error, which then wrapped into a ribbon. The table has
          eight columns and wants the full width too, so they're stacked. */}
      <div className="flex flex-col gap-6">
        <div className="card p-4 overflow-x-auto">
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
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState("active"); // active | archive

  const refreshEvents = useCallback(async () => {
    const res = await fetch("/api/events");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const data = await res.json();
    setEvents(data.events);
    setSelectedId((prev) => {
      if (prev) return prev;
      const firstActive = data.events.find((e) => e.displayStatus === "active");
      return firstActive ? firstActive.id : prev;
    });
  }, []);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  if (authed === null) {
    return <main className="min-h-screen flex items-center justify-center">جاري التحميل...</main>;
  }
  if (authed === false) {
    return <LoginForm onLoggedIn={refreshEvents} />;
  }

  const activeEvents = events.filter((e) => e.displayStatus === "active");
  const selectedEvent = events.find((e) => e.id === selectedId);

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <DashboardHeader
        title="لوحة الإدارة"
        subtitle={`${activeEvents.length} مناسبة نشطة`}
        onLogout={async () => {
          await fetch("/api/admin/login", { method: "DELETE" });
          setAuthed(false);
        }}
      />

      <div className="wrap p-5 flex flex-col gap-6" style={{ maxWidth: "80rem" }}>
      <EnquiriesInbox />

      <div className="tab-switch">
        <button data-active={view === "active"} onClick={() => setView("active")}>المناسبات النشطة</button>
        <button data-active={view === "archive"} onClick={() => setView("archive")}>الأرشيف</button>
      </div>

      {view === "active" ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="field"
            >
              <option value="" disabled>اختر زفافًا</option>
              {activeEvents.map((e) => (
                <option key={e.id} value={e.id}>{e.coupleNames} — {e.guestCount}/{e.packageLimit}</option>
              ))}
            </select>
            <button onClick={() => setShowCreate((v) => !v)} className="pill-btn-outline pill-btn-sm">
              {showCreate ? "إلغاء" : "+ زفاف جديد"}
            </button>
          </div>

          <TechnicalToolsPanel />

          {showCreate && (
            <CreateEventForm
              onCreated={(event) => {
                setShowCreate(false);
                setEvents((evs) => [event, ...evs]);
                setSelectedId(event.id);
              }}
            />
          )}

          {selectedEvent && selectedEvent.displayStatus !== "deleted" ? (
            <EventDashboard
              key={selectedEvent.id}
              event={selectedEvent}
              onDeleted={() => {
                setSelectedId(null);
                refreshEvents();
              }}
              onUpdated={() => refreshEvents()}
            />
          ) : (
            !showCreate && activeEvents.length === 0 && (
              <p className="text-ink-2">لا توجد أعراس نشطة بعد — اضغط &quot;+ زفاف جديد&quot; للبدء</p>
            )
          )}
        </>
      ) : (
        <ArchiveList
          events={events}
          onOpen={(id) => {
            setSelectedId(id);
            setView("active");
          }}
          onRecalled={refreshEvents}
        />
      )}
      </div>
    </main>
  );
}
