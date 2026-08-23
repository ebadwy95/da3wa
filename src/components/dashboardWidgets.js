"use client";

// Shared pieces used by both the platform admin dashboard (/admin) and the
// couple's own scoped dashboard (/couple) — guest management should look
// and work identically for both, the only difference is WHICH event(s)
// each one is allowed to touch (enforced server-side, not here).

import { useRef, useState } from "react";

export function StatCard({ label, value, accent }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-3xl font-bold" style={{ color: accent || "var(--gold-dark)" }}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export function GuestRow({ guest, onDelete }) {
  const [copied, setCopied] = useState(false);
  const statusLabel = { pending: "لم يردّ بعد", confirmed: "أكّد الحضور", declined: "اعتذر" }[guest.status];
  const statusColor = { pending: "#a08a5a", confirmed: "#2e7d32", declined: "#b3261e" }[guest.status];

  // maxCompanions is stored internally as "companions beyond the guest" —
  // the total party size shown to the admin/couple (what they actually set)
  // is that plus the guest themself.
  const maxTotalGuests = (guest.maxCompanions || 0) + 1;
  const partySize = guest.status === "confirmed" ? 1 + (guest.confirmedCompanions || 0) : null;
  const checkedInCount = guest.checkedInCount || 0;

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
      <td className="py-3 px-2 text-center">{maxTotalGuests}</td>
      <td className="py-3 px-2 text-center">
        <span style={{ color: statusColor }} className="font-semibold text-sm">{statusLabel}</span>
        {guest.status === "confirmed" && (
          <div className="text-xs text-gray-500 mt-0.5">
            الحضور: {partySize} ({guest.confirmedCompanions || 0} مرافق)
          </div>
        )}
      </td>
      <td className="py-3 px-2 text-center">
        {!partySize ? (
          <span className="text-gray-400 text-sm">—</span>
        ) : checkedInCount === 0 ? (
          <span className="text-gray-400 text-sm">لم يدخل أحد بعد</span>
        ) : checkedInCount >= partySize ? (
          <span className="text-green-700 font-semibold text-sm">✅ دخل الجميع ({checkedInCount}/{partySize})</span>
        ) : (
          <span className="font-semibold text-sm" style={{ color: "#a08a2d" }}>
            دخل {checkedInCount} من {partySize}
          </span>
        )}
      </td>
      <td className="py-3 px-2 text-center">
        {guest.invitedAt ? <span className="text-sm text-green-700">تم الإرسال</span> : <span className="text-sm text-gray-400">لم تُرسل بعد</span>}
      </td>
      <td className="py-3 px-2 text-center whitespace-nowrap">
        <button onClick={copyLink} className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          {copied ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
      </td>
      <td className="py-3 px-2 text-center">
        <button onClick={() => onDelete(guest.id)} className="text-sm text-red-500 hover:underline">حذف</button>
      </td>
    </tr>
  );
}

export function LimitReachedModal({ info, onForceAdd, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="card p-6 max-w-sm w-full space-y-4 text-center">
        <h3 className="font-bold text-lg">تم الوصول إلى الحد الأقصى للباقة</h3>
        <p className="text-sm text-gray-600">
          تسمح باقة هذا الزفاف بـ {info.packageLimit} دعوة، وقد أضفت حتى الآن {info.guestCount} ضيف.
          ماذا تودّ أن تفعل؟
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onForceAdd} className="pill-btn">
            إضافة هذا الضيف رغم ذلك (زيادة عن حدود الباقة)
          </button>
          <a
            href="https://wa.me/?text=أرغب%20في%20ترقية%20باقة%20الزفاف"
            target="_blank"
            rel="noreferrer"
            className="py-2 rounded-lg font-semibold border"
            style={{ borderColor: "#eee0cc" }}
          >
            التواصل مع الإدارة لترقية الباقة
          </a>
          <button onClick={onCancel} className="text-sm text-gray-400 underline mt-1">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddGuestForm({ eventId, onAdded }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Total party size for this invite, guest included — e.g. 3 means the
  // guest plus two companions, not three companions on top of them.
  // Defaults to 1 (the guest alone).
  const [maxGuests, setMaxGuests] = useState(1);
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
        body: JSON.stringify({ name, phone, maxGuests, force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.limitReached) {
        setLimitInfo(data);
        return;
      }
      if (!res.ok) throw new Error(data.error || "تعذّرت إضافة الضيف");
      onAdded(data.guest);
      setName("");
      setPhone("");
      setMaxGuests(1);
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
          <label className="block text-xs text-gray-500 mb-1">رقم الواتساب (مع رمز الدولة)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" placeholder="+9665XXXXXXXX" className="w-full border rounded-lg px-3 py-2 outline-none" style={{ borderColor: "#eee0cc" }} />
        </div>
        <div className="w-40">
          <label className="block text-xs text-gray-500 mb-1">إجمالي عدد الحضور (شامل الضيف نفسه)</label>
          <input type="number" min={1} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none" style={{ borderColor: "#eee0cc" }} />
        </div>
        <button disabled={saving} className="pill-btn px-6">{saving ? "جارٍ الإضافة..." : "إضافة"}</button>
        {error && <p className="text-red-600 text-sm w-full">{error}</p>}
      </form>
    </>
  );
}

export function BulkUpload({ eventId, onDone }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("يجب اختيار ملف أولًا قبل الضغط على زر الرفع");
      return;
    }
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/events/${eventId}/guests/bulk`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر رفع الملف");
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
        <h2 className="font-bold">رفع كشف ضيوف دفعة واحدة</h2>
        <a href="/da3wa-guests-template.csv" download className="text-sm underline" style={{ color: "var(--gold-dark)" }}>
          تحميل النموذج
        </a>
      </div>
      <p className="text-xs text-gray-500">
        يجب أن يكون الملف بنفس أعمدة النموذج وبنفس الترتيب تمامًا: الاسم، رقم الواتساب (مع رمز الدولة)، إجمالي عدد
        الحضور (شامل الضيف نفسه — أي لو سيأتي مع مرافقَين، يُكتب 3 وليس 2). أي ملف بترتيب مختلف سيُرفض.
      </p>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="text-sm"
        />
        <button onClick={upload} disabled={uploading} className="pill-btn text-sm">
          {uploading ? "جارٍ الرفع..." : "رفع الملف"}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {result && (
        <div className="text-sm space-y-1 border-t pt-2" style={{ borderColor: "#f1e8d8" }}>
          <p className="text-green-700 font-semibold">تمت إضافة {result.added} ضيف من أصل {result.totalRowsInFile}</p>
          {result.errors?.length > 0 && (
            <div className="text-amber-700">
              <p className="font-semibold">تم تخطي {result.errors.length} صف:</p>
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

export function SendInvitesButton({ eventId, guests, onDone }) {
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
        <p className="text-xs text-gray-500">{notYetInvited} ضيف لم يصله رابط الدعوة بعد</p>
        {result && <p className="text-xs mt-1 text-green-700">تم الإرسال إلى {result.sent} — وفشل الإرسال إلى {result.failed}</p>}
      </div>
      <button
        onClick={send}
        disabled={sending || notYetInvited === 0}
        className="pill-btn px-6"
      >
        {sending ? "جارٍ الإرسال..." : `إرسال الدعوات (${notYetInvited})`}
      </button>
    </div>
  );
}

export function WhatsappFeed({ messages, watiConfigured }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">سجلّ رسائل واتساب</h2>
        <span
          className="text-xs px-2 py-1 rounded-full font-semibold"
          style={{ background: watiConfigured ? "#e6f4ea" : "#fdecea", color: watiConfigured ? "#2e7d32" : "#b3261e" }}
        >
          {watiConfigured ? "متصل بـ Wati — إرسال حقيقي" : "غير متصل — محاكاة فقط"}
        </span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-6">لا توجد رسائل بعد</p>}
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
                {{ sent: "تم الإرسال فعليًا", simulated: "محاكاة", failed: "فشل الإرسال", logged: "مسجَّلة" }[m.status]}
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

// A wall of the short well-wish / congratulation messages guests leave from
// their own invite page (see src/app/invite/[id]/page.js) — regardless of
// whether they confirmed or declined attendance. Newest first.
export function WishWall({ guests }) {
  const wishes = guests
    .filter((g) => g.wishMessage)
    .slice()
    .sort((a, b) => new Date(b.wishMessageAt || 0) - new Date(a.wishMessageAt || 0));

  return (
    <div className="card p-4">
      <h2 className="font-bold mb-3">رسائل التهنئة من الضيوف</h2>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {wishes.length === 0 && <p className="text-sm text-gray-400 text-center py-6">لم تصل رسائل تهنئة بعد</p>}
        {wishes.map((g) => (
          <div key={g.id} className="border rounded-lg p-3 text-sm" style={{ borderColor: "#f1e8d8" }}>
            <p className="text-gray-700 leading-relaxed">{g.wishMessage}</p>
            <p className="text-gray-400 text-xs mt-1">
              — {g.name}
              {g.wishMessageAt && <> · {new Date(g.wishMessageAt).toLocaleString("ar-EG")}</>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Live audit trail of every door-scan attempt (accepted or rejected) for
// this event, including which scanner-staff member made it — so the
// admin/couple can see in real time who actually entered, and spot anything
// that looks like someone trying to reuse an already-used QR.
export function CheckinLogFeed({ logs }) {
  return (
    <div className="card p-4">
      <h2 className="font-bold mb-3">سجلّ الدخول عند الباب</h2>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {logs.length === 0 && <p className="text-sm text-gray-400 text-center py-6">لا توجد عمليات دخول مسجَّلة بعد</p>}
        {logs.map((l) => (
          <div
            key={l.id}
            className="border rounded-lg p-3 text-sm"
            style={{ borderColor: l.ok ? "#f1e8d8" : "#f5c6c6", background: l.ok ? "transparent" : "#fff8f8" }}
          >
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium">{l.guestName || "رمز غير معروف"}</span>
              <span
                className="text-xs shrink-0 px-2 py-0.5 rounded-full font-semibold"
                style={{ background: l.ok ? "#e6f4ea" : "#fdecea", color: l.ok ? "#2e7d32" : "#b3261e" }}
              >
                {l.ok ? "دخول ناجح" : "مرفوض"}
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-1">{l.message}</p>
            <p className="text-gray-400 text-xs mt-1">
              بواسطة: {l.staffName || "غير معروف"} — {new Date(l.createdAt).toLocaleString("ar-EG")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
