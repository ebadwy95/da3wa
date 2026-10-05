"use client";

// Shared pieces used by both the platform admin dashboard (/admin) and the
// couple's own scoped dashboard (/couple) — guest management should look
// and work identically for both, the only difference is WHICH event(s)
// each one is allowed to touch (enforced server-side, not here).

import { useMemo, useRef, useState } from "react";
import { CheckCircleIcon, SendIcon, UploadIcon, UsersIcon, InboxIcon, ClockIcon, AlertIcon, EyeIcon, PhoneIcon, MessageIcon, XIcon, SearchIcon, PencilIcon, LockIcon } from "@/components/icons";
import { formatDateTimeArabic } from "@/lib/date";
import { guestKind, KIND_LABEL } from "@/lib/guestKind";

// The invitation as a guest will see it, one tab each for the two cards. Opens
// the preview page, which uses a made-up guest, so looking never answers an
// RSVP for anyone.
export function InvitePreviewButtons({ eventId, cardToken, className = "" }) {
  if (!eventId) return null;
  const href = (lang) => `/invite/preview/${eventId}?lang=${lang}`;
  // The thank-you card goes out the day after the wedding, which is a bad time
  // to discover what it says — so it is previewable from the day the wedding is
  // created, in whichever language the couple is checking.
  const thanks = (lang) =>
    `/api/cards/thanks/${eventId}/card.png?lang=${lang}&t=${encodeURIComponent(cardToken)}`;
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <a href={href("ar")} target="_blank" rel="noopener" className="pill-btn-outline pill-btn-sm" title="معاينة الدعوة العربية">
        <EyeIcon size={15} />
        معاينة عربي
      </a>
      <a href={href("en")} target="_blank" rel="noopener" className="pill-btn-outline pill-btn-sm" title="معاينة الدعوة الإنجليزية">
        <EyeIcon size={15} />
        <span lang="en">View English</span>
      </a>
      {cardToken ? (
        <>
          <a href={thanks("ar")} target="_blank" rel="noopener" className="pill-btn-outline pill-btn-sm" title="بطاقة الشكر التي تُرسل بعد الزفاف">
            <EyeIcon size={15} />
            بطاقة الشكر
          </a>
          <a href={thanks("en")} target="_blank" rel="noopener" className="pill-btn-outline pill-btn-sm" title="بطاقة الشكر بالإنجليزية">
            <EyeIcon size={15} />
            <span lang="en">Thank-you card</span>
          </a>
        </>
      ) : null}
    </div>
  );
}

export function StatCard({ label, value, accent }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-3xl font-bold" style={{ color: accent || "var(--gold-600)" }}>
        {value}
      </div>
      <div className="text-xs text-ink-2 mt-1">{label}</div>
    </div>
  );
}

// The numbers at the top of a wedding's dashboard, each one a door: tap it
// and see who is behind it, with a call and a WhatsApp button on every name —
// so the couple can follow up personally, from their own phone, with the
// people who haven't answered (or ask gently why someone declined).
// Each card looks at one kind of guest: the invitation numbers at
// invitations, the family and sharing cards at their own.
const BREAKDOWNS = [
  {
    key: "invited",
    label: "إجمالي الدعوات",
    accent: null,
    sections: (g) => [{ title: null, list: g }],
  },
  {
    key: "confirmed",
    label: "أكدوا",
    accent: "var(--ok)",
    sections: (g) => [{ title: null, list: g.filter((x) => x.status === "confirmed") }],
  },
  {
    key: "pending",
    label: "لم يردّوا بعد",
    accent: "var(--gold-600)",
    sections: (g) => {
      const pending = g.filter((x) => x.status === "pending");
      return [
        { title: "فتحوا الدعوة وما ردّوا", list: pending.filter((x) => x.openedAt) },
        { title: "ما فتحوا الدعوة", list: pending.filter((x) => !x.openedAt) },
      ];
    },
  },
  {
    key: "declined",
    label: "اعتذروا",
    accent: "var(--danger)",
    sections: (g) => [{ title: null, list: g.filter((x) => x.status === "declined") }],
  },
  {
    key: "expectedAttendees",
    label: "إجمالي الحضور المتوقع",
    accent: "var(--info)",
    sections: (g) => [{ title: null, list: g.filter((x) => x.status === "confirmed") }],
  },
  {
    key: "peopleCheckedIn",
    label: "دخلوا فعلاً (عدد الأفراد)",
    accent: "var(--info)",
    sections: (g) => {
      const confirmed = g.filter((x) => x.status === "confirmed");
      return [
        { title: "دخلوا القاعة", list: confirmed.filter((x) => (x.checkedInCount || 0) > 0) },
        { title: "أكدوا وما وصلوا للحين", list: confirmed.filter((x) => !(x.checkedInCount || 0)) },
      ];
    },
  },
  {
    key: "familyPeople",
    label: "أهل الفرح (أفراد)",
    accent: "#8a5a2b",
    scope: "family",
    sections: (g) => [{ title: null, list: g }],
  },
  {
    key: "share",
    label: "مشاركة الفرحة",
    accent: "#2f5f9e",
    scope: "share",
    sections: (g) => [
      { title: "فتحوا البطاقة", list: g.filter((x) => x.openedAt) },
      { title: "ما فتحوها", list: g.filter((x) => !x.openedAt) },
    ],
  },
];

function partyLabel(n) {
  if (n === 1) return "شخص واحد";
  if (n === 2) return "شخصين";
  return `${n} أشخاص`;
}

function guestDetail(g) {
  const kind = guestKind(g);
  if (kind === "family") return `أهل الفرح — ${partyLabel(1 + (g.maxCompanions || 0))}${g.openedAt ? " — فتح البطاقة" : ""}`;
  if (kind === "share") return g.openedAt ? "فتح البطاقة" : g.invitedAt ? "انرسلت له" : "ما انرسلت له";
  const party = 1 + (g.confirmedCompanions || 0);
  if (g.status === "confirmed") {
    const inside = g.checkedInCount || 0;
    return inside ? `دخل ${inside} من ${party}` : `أكد — ${partyLabel(party)}`;
  }
  if (g.status === "declined") return "اعتذر";
  if (g.openedAt) return "فتح الدعوة وما رد";
  return g.invitedAt ? "انرسلت له وما فتحها" : "ما انرسلت له الدعوة";
}

function BreakdownSheet({ item, guests, onClose }) {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => {
    const q = query.trim();
    const match = (g) => !q || g.name.includes(q) || String(g.phoneDisplay || g.phone).includes(q);
    const scoped = guests.filter((g) => guestKind(g) === (item.scope || "invite"));
    return item.sections(scoped).map((sec) => ({ ...sec, list: sec.list.filter(match) }));
  }, [item, guests, query]);
  const total = sections.reduce((n, sec) => n + sec.list.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="card w-full sm:max-w-lg flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={item.label}
      >
        <div className="p-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--line-soft)" }}>
          <p className="font-bold" style={{ color: item.accent || "var(--gold-600)" }}>
            {item.label} <span className="tnum text-ink-2">({total})</span>
          </p>
          <button onClick={onClose} className="pill-btn-ghost pill-btn-sm" aria-label="إغلاق">
            <XIcon size={16} />
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="دوّر باسم أو رقم"
              className="field w-full"
              style={{ paddingInlineStart: "2.25rem" }}
            />
            <span
              className="absolute"
              style={{ insetInlineStart: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }}
            >
              <SearchIcon size={16} />
            </span>
          </div>
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-4">
          {sections.map((sec, i) => (
            <div key={i} className="flex flex-col gap-2">
              {sec.title && (
                <p className="text-sm font-semibold text-ink-2">
                  {sec.title} <span className="tnum">({sec.list.length})</span>
                </p>
              )}
              {sec.list.length === 0 ? (
                <p className="text-sm text-ink-3">ما في أحد.</p>
              ) : (
                sec.list.map((g) => {
                  const digits = String(g.phoneDisplay || g.phone || "").replace(/[^0-9]/g, "");
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-2 rounded-xl p-2.5"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{g.name}</p>
                        <p className="text-xs text-ink-2">{guestDetail(g)}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <a href={`tel:+${digits}`} className="pill-btn-outline pill-btn-sm" aria-label={`اتصال بـ${g.name}`}>
                          <PhoneIcon size={15} /> اتصال
                        </a>
                        <a
                          href={`https://wa.me/${digits}`}
                          target="_blank"
                          rel="noreferrer"
                          className="pill-btn pill-btn-sm"
                          style={{ background: "#1d5c47", borderColor: "#1d5c47" }}
                          aria-label={`واتساب ${g.name}`}
                        >
                          <MessageIcon size={15} /> واتساب
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// The same guest list read down the two sides of the family: how many
// invitations each of them sent, how many people that is, who has answered,
// and — the number the couple actually want — where the headcount lands if
// everyone still silent says yes.
const SIDE_ROWS = [
  { key: "groom", label: "ضيوف العريس" },
  { key: "bride", label: "ضيوف العروس" },
  { key: "none", label: "بدون طرف" },
];

function sideTotals(guests) {
  const blank = () => ({
    invites: 0,
    people: 0,
    sent: 0,
    confirmed: 0,
    confirmedPeople: 0,
    declined: 0,
    pending: 0,
    pendingPeople: 0,
    family: 0,
    familyPeople: 0,
    share: 0,
  });
  const totals = { groom: blank(), bride: blank(), none: blank(), all: blank() };

  for (const g of guests) {
    const row = totals[g.side === "groom" || g.side === "bride" ? g.side : "none"];
    const kind = guestKind(g);
    const allowed = 1 + (g.maxCompanions || 0);
    for (const t of [row, totals.all]) {
      if (kind === "family") {
        t.family += 1;
        t.familyPeople += allowed;
        continue;
      }
      if (kind === "share") {
        t.share += 1;
        continue;
      }
      t.invites += 1;
      t.people += allowed;
      if (g.invitedAt) t.sent += 1;
      if (g.status === "confirmed") {
        t.confirmed += 1;
        t.confirmedPeople += 1 + (g.confirmedCompanions || 0);
      } else if (g.status === "declined") {
        t.declined += 1;
      } else {
        t.pending += 1;
        t.pendingPeople += allowed;
      }
    }
  }
  return totals;
}

export function SidesTable({ guests }) {
  const totals = useMemo(() => sideTotals(guests || []), [guests]);
  if (!guests?.length) return null;
  const rows = SIDE_ROWS.filter(
    (r) => totals[r.key].invites || totals[r.key].family || totals[r.key].share
  );

  const cell = (t) => [
    t.invites,
    t.people,
    t.sent,
    t.confirmed,
    t.confirmedPeople,
    t.declined,
    t.pending,
    // Where the night lands if everyone still silent says yes, at the full
    // allowance they were each given.
    t.confirmedPeople + t.pendingPeople,
    t.family ? `${t.family} (${t.familyPeople})` : "—",
    t.share || "—",
  ];
  const headers = [
    "",
    "الدعوات",
    "الأفراد المسموحين",
    "انرسلت",
    "أكدوا",
    "أفراد مؤكدين",
    "اعتذروا",
    "ما ردوا",
    "لو الكل أكد",
    "أهل الفرح (أفراد)",
    "مشاركة الفرحة",
  ];

  return (
    <div className="card p-4 space-y-2">
      <h2 className="font-bold">التقسيم حسب الطرف</h2>
      <p className="text-xs text-ink-2 leading-relaxed">
        «لو الكل أكد» = الأفراد المؤكدين الآن + كل اللي ما ردوا بكامل العدد المسموح لهم — أعلى رقم ممكن توصله
        القاعة. أهل الفرح يجون بدون تأكيد، فيُحسبون بعددهم المسموح.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-ink-2" style={{ fontSize: "var(--text-xs)" }}>
              {headers.map((h, i) => (
                <th key={i} className="py-2 px-2 text-center whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t" style={{ borderColor: "var(--line-soft)" }}>
                <td className="py-2 px-2 font-semibold whitespace-nowrap">{r.label}</td>
                {cell(totals[r.key]).map((v, i) => (
                  <td key={i} className="py-2 px-2 text-center tnum">{v}</td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 font-bold" style={{ borderColor: "var(--line)" }}>
              <td className="py-2 px-2 whitespace-nowrap">الإجمالي</td>
              {cell(totals.all).map((v, i) => (
                <td key={i} className="py-2 px-2 text-center tnum" style={i === 7 ? { color: "var(--gold-600)" } : undefined}>
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GuestBreakdown({ stats, guests }) {
  const [open, setOpen] = useState(null);
  if (!stats) return null;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {BREAKDOWNS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setOpen(item)}
            className="card p-4 text-center"
            style={{ cursor: "pointer" }}
            aria-label={`${item.label}: ${stats[item.key]} — اعرض الأسماء`}
          >
            <div className="text-3xl font-bold" style={{ color: item.accent || "var(--gold-600)" }}>
              {stats[item.key] ?? 0}
            </div>
            <div className="text-xs text-ink-2 mt-1">{item.label}</div>
            <div className="mt-1" style={{ fontSize: "0.65rem", color: "var(--ink-3)" }}>
              اضغط لعرض الأسماء
            </div>
          </button>
        ))}
      </div>
      {open && <BreakdownSheet item={open} guests={guests} onClose={() => setOpen(null)} />}
    </>
  );
}

// Which card a guest gets: Arabic unless someone picks English. Changed from the
// guest's row before sending, so it has to be one tap and visibly the current
// choice — a dropdown hides which one is set until it is opened.
export function GuestLanguageToggle({ guest, onChanged }) {
  const [language, setLanguage] = useState(guest.language === "en" ? "en" : "ar");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function choose(next) {
    if (next === language || saving) return;
    const previous = language;
    setLanguage(next); // optimistic — the toggle should move under the finger
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر تغيير اللغة");
      onChanged?.();
    } catch (err) {
      setLanguage(previous);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="lang-toggle" role="radiogroup" aria-label={`لغة دعوة ${guest.name}`}>
        <button type="button" role="radio" aria-checked={language === "ar"} data-on={language === "ar"} onClick={() => choose("ar")} disabled={saving}>
          عربي
        </button>
        <button type="button" role="radio" aria-checked={language === "en"} data-on={language === "en"} onClick={() => choose("en")} disabled={saving} lang="en">
          English
        </button>
      </div>
      {error && <span className="text-danger text-xs">{error}</span>}
    </div>
  );
}

// Whose guest this is — the groom's or the bride's. Decides which of the two
// see them in the sending app (/send); a guest with no side shows to both.
// Tapping the chosen side again clears it.
export function GuestSideToggle({ guest, onChanged }) {
  const [side, setSide] = useState(guest.side || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function choose(next) {
    if (saving) return;
    const value = next === side ? null : next;
    const previous = side;
    setSide(value);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      onChanged?.();
    } catch (err) {
      setSide(previous);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="lang-toggle" role="radiogroup" aria-label={`طرف ${guest.name}`}>
        <button type="button" role="radio" aria-checked={side === "groom"} data-on={side === "groom"} onClick={() => choose("groom")} disabled={saving}>
          العريس
        </button>
        <button type="button" role="radio" aria-checked={side === "bride"} data-on={side === "bride"} onClick={() => choose("bride")} disabled={saving}>
          العروس
        </button>
      </div>
      {error && <span className="text-danger text-xs">{error}</span>}
    </div>
  );
}

// Correcting a guest — name, number, how many the invitation is for — from
// the admin dashboard, until the guest opens their invitation. After that the
// pencil is a lock: they've seen the card, and the server refuses it too.
function EditGuestDialog({ guest, onClose, onSaved }) {
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phoneDisplay || guest.phone);
  const [maxGuests, setMaxGuests] = useState((guest.maxCompanions || 0) + 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, maxGuests }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <form onSubmit={save} className="card w-full max-w-sm p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`تعديل ${guest.name}`}>
        <p className="font-bold">تعديل بيانات الضيف</p>
        <div>
          <label className="label">الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field w-full" required autoFocus />
        </div>
        <div>
          <label className="label">رقم الواتساب (مع كود الدولة)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field w-full" dir="ltr" required />
        </div>
        <div>
          <label className="label">إجمالي عدد الحضور (شامل الضيف نفسه)</label>
          <input type="number" min={1} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} className="field w-full" />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <div className="flex gap-2">
          <button disabled={saving} className="pill-btn flex-1">{saving ? "..." : "حفظ"}</button>
          <button type="button" onClick={onClose} className="pill-btn-outline">إلغاء</button>
        </div>
      </form>
    </div>
  );
}

// What the guest's link is: an invitation, the family's card, or the card
// sharing the joy with someone who can't come.
export function GuestKindSelect({ guest, onChanged }) {
  const [kind, setKind] = useState(guestKind(guest));
  const [saving, setSaving] = useState(false);

  async function choose(next) {
    const previous = kind;
    setKind(next);
    setSaving(true);
    const res = await fetch(`/api/guests/${guest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: next }),
    }).catch(() => null);
    if (!res?.ok) setKind(previous);
    else onChanged?.();
    setSaving(false);
  }

  return (
    <select
      value={kind}
      disabled={saving}
      onChange={(e) => choose(e.target.value)}
      className="field"
      style={{ padding: "0.2rem 0.5rem", fontSize: "var(--text-xs)", marginTop: "0.35rem", width: "auto" }}
      aria-label={`نوع دعوة ${guest.name}`}
    >
      <option value="invite">{KIND_LABEL.invite}</option>
      <option value="family">{KIND_LABEL.family}</option>
      <option value="share">{KIND_LABEL.share}</option>
    </select>
  );
}

export function GuestRow({ guest, onDelete, onChanged, editable = false }) {
  const [editing, setEditing] = useState(false);
  // Open (or answered) means the guest has seen their card: no more edits.
  const locked = Boolean(guest.openedAt) || guest.status !== "pending";
  const [copied, setCopied] = useState(false);
  // The family's and the sharing cards have nothing to answer.
  const kind = guestKind(guest);
  const statusLabel =
    kind === "invite"
      ? { pending: "لم يردّ بعد", confirmed: "أكّد الحضور", declined: "اعتذر" }[guest.status]
      : `${KIND_LABEL[kind]}${guest.openedAt ? " — فتح البطاقة" : ""}`;
  const statusColor =
    kind === "invite"
      ? { pending: "var(--gold-600)", confirmed: "var(--ok)", declined: "var(--danger)" }[guest.status]
      : kind === "family" ? "#8a5a2b" : "#2f5f9e";

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
    <tr className="border-b last:border-0" style={{ borderColor: "var(--line-soft)" }}>
      <td className="py-3 px-2 font-medium">
        <span className="inline-flex items-center gap-1.5">
          {guest.name}
          {editable &&
            (locked ? (
              <span title="الضيف فتح الدعوة — ما يصير تعديل" style={{ color: "var(--ink-3)" }} aria-label="مقفول للتعديل">
                <LockIcon size={13} />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="pill-btn-ghost"
                style={{ padding: "0.15rem", color: "var(--gold-600)" }}
                aria-label={`تعديل ${guest.name}`}
                title="تعديل الاسم أو الرقم أو العدد"
              >
                <PencilIcon size={14} />
              </button>
            ))}
        </span>
        {editing && <EditGuestDialog guest={guest} onClose={() => setEditing(false)} onSaved={() => onChanged?.()} />}
      </td>
      <td className="py-3 px-2 text-center">
        <GuestLanguageToggle guest={guest} onChanged={onChanged} />
      </td>
      <td className="py-3 px-2 text-center">
        <GuestSideToggle guest={guest} onChanged={onChanged} />
        <div>
          <GuestKindSelect guest={guest} onChanged={onChanged} />
        </div>
      </td>
      <td className="py-3 px-2 text-ink-2" dir="ltr">{guest.phoneDisplay || guest.phone}</td>
      <td className="py-3 px-2 text-center">{maxTotalGuests}</td>
      <td className="py-3 px-2 text-center">
        <span style={{ color: statusColor }} className="font-semibold text-sm">{statusLabel}</span>
        {guest.status === "confirmed" && (
          <div className="text-xs text-ink-2 mt-0.5">
            الحضور: {partySize} ({guest.confirmedCompanions || 0} مرافق)
          </div>
        )}
      </td>
      <td className="py-3 px-2 text-center">
        {!partySize ? (
          <span className="text-ink-3 text-sm">—</span>
        ) : checkedInCount === 0 ? (
          <span className="text-ink-3 text-sm">لم يدخل أحد بعد</span>
        ) : checkedInCount >= partySize ? (
          <span className="chip chip-ok tnum"><CheckCircleIcon size={13} />دخل الجميع ({checkedInCount}/{partySize})</span>
        ) : (
          <span className="font-semibold text-sm" style={{ color: "var(--warn)" }}>
            دخل {checkedInCount} من {partySize}
          </span>
        )}
      </td>
      <td className="py-3 px-2 text-center">
        {guest.invitedAt ? <span className="text-sm text-ok">تم الإرسال</span> : <span className="text-sm text-ink-3">لم تُرسل بعد</span>}
        {/* Whether they actually looked at it. WhatsApp's own read receipt
            needs a webhook the cheaper provider plans don't include, and this
            says more anyway: a guest who opened the card and still hasn't
            answered is the one to nudge. */}
        {guest.openedAt ? (
          <div className="text-xs text-ok mt-0.5" title={formatDateTimeArabic(guest.lastOpenedAt || guest.openedAt)}>
            فتح الدعوة{guest.openCount > 1 ? ` (${guest.openCount} مرات)` : ""}
          </div>
        ) : guest.invitedAt ? (
          <div className="text-xs text-ink-3 mt-0.5">لم يفتحها بعد</div>
        ) : null}
      </td>
      <td className="py-3 px-2 text-center whitespace-nowrap">
        <button onClick={copyLink} className="pill-btn-outline pill-btn-sm">
          {copied ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
        {/* The card this guest got on WhatsApp when they confirmed — their
            own code, their own name, and the party size they chose. It does
            not exist before they answer: it carries the number of people
            they confirmed, not the allowance they were invited with. */}
        {guest.status === "confirmed" && guest.cardLink ? (
          <a
            href={guest.cardLink}
            target="_blank"
            rel="noopener noreferrer"
            className="pill-btn-outline pill-btn-sm mr-2 inline-flex items-center gap-1"
          >
            <EyeIcon size={14} /> البطاقة
          </a>
        ) : null}
      </td>
      <td className="py-3 px-2 text-center">
        <button onClick={() => onDelete(guest.id)} className="pill-btn-danger pill-btn-sm">حذف</button>
      </td>
    </tr>
  );
}

export function LimitReachedModal({ info, onForceAdd, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="card p-6 max-w-sm w-full space-y-4 text-center">
        <h3 className="font-bold text-lg">تم الوصول إلى الحد الأقصى للباقة</h3>
        <p className="text-sm text-ink-2">
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
          >
            التواصل مع الإدارة لترقية الباقة
          </a>
          <button onClick={onCancel} className="pill-btn-ghost pill-btn-sm mt-1">
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
  // Arabic by default; English for a guest who doesn't read Arabic.
  const [language, setLanguage] = useState("ar");
  // The groom's guest or the bride's — who sends to them from /send.
  const [side, setSide] = useState("");
  const [kind, setKind] = useState("invite");
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
        body: JSON.stringify({ name, phone, maxGuests, language, side: side || null, kind, force }),
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
      setLanguage("ar");
      setSide("");
      setKind("invite");
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
          <label className="label">اسم الضيف</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="field" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">رقم الواتساب (مع رمز الدولة)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" placeholder="96550012345" className="field" />
        </div>
        <div className="w-40">
          <label className="label">إجمالي عدد الحضور (شامل الضيف نفسه)</label>
          <input type="number" min={1} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} className="field" />
        </div>
        <div className="w-36">
          <label className="label">لغة الدعوة</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field">
            <option value="ar">عربي</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="w-36">
          <label className="label">الطرف</label>
          <select value={side} onChange={(e) => setSide(e.target.value)} className="field">
            <option value="">—</option>
            <option value="groom">العريس</option>
            <option value="bride">العروس</option>
          </select>
        </div>
        <div className="w-40">
          <label className="label">نوع الدعوة</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="field">
            <option value="invite">{KIND_LABEL.invite}</option>
            <option value="family">{KIND_LABEL.family}</option>
            <option value="share">{KIND_LABEL.share}</option>
          </select>
        </div>
        <button disabled={saving} className="pill-btn px-6">{saving ? "جارٍ الإضافة..." : "إضافة"}</button>
        {error && <p className="text-danger text-sm w-full">{error}</p>}
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
        {/* The Excel file, not the CSV: its phone column is already text, so
            Excel can't drop the + or turn a long number into 9.66E+11. */}
        <a href="/da3wa-guests-template.xlsx" download className="pill-btn-outline pill-btn-sm">
          تحميل النموذج
        </a>
      </div>
      <p className="text-xs text-ink-2">
        يجب أن يكون الملف بنفس أعمدة النموذج وبنفس الترتيب تمامًا: الاسم، رقم الواتساب بكود الدولة من غير +
        (مثلًا 96550012345 للكويت أو 966512345678 للسعودية)، إجمالي عدد الحضور (شامل الضيف نفسه — أي لو سيأتي مع
        مرافقَين، يُكتب 3 وليس 2)، ولغة الدعوة: AR للعربي أو ENG للإنجليزي (لو الخانة فاضية تبقى عربي)، والطرف:
        العريس أو العروس — يحدد مين يرسل للضيف من تطبيق الإرسال (لو فاضية يظهر عند الاثنين)، ونوع الدعوة: دعوة،
        أو أهل (أهل الفرح — يجون بدون بطاقة دخول)، أو مشاركة (للي برّه وما يقدرون يحضرون) — لو فاضية تبقى دعوة. أي ملف بترتيب
        مختلف سيُرفض.
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
      {error && <p className="text-danger text-sm">{error}</p>}
      {result && (
        <div className="text-sm space-y-1 border-t pt-2" style={{ borderColor: "var(--line-soft)" }}>
          <p className="text-ok font-semibold">
            تمت إضافة {result.added} ضيف من أصل {result.totalRowsInFile}
            {result.addedEnglish > 0 && ` — منهم ${result.addedEnglish} بدعوة English`}
          </p>
          {result.errors?.length > 0 && (
            <div className="text-warn">
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
        <p className="text-xs text-ink-2">{notYetInvited} ضيف لم يصله رابط الدعوة بعد</p>
        {result && <p className="text-xs mt-1 text-ok">تم الإرسال إلى {result.sent} — وفشل الإرسال إلى {result.failed}</p>}
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

// "sent" only means Wati accepted the message; WhatsApp's real verdict arrives
// later over the webhook (see src/app/api/whatsapp/webhook). The labels keep
// that distinction visible — "تم التسليم" is WhatsApp confirming the phone got
// it, "أُرسلت" is only that it left the building.
//
// "opened" and "answered" are not WhatsApp's words but the guest's own: the
// feed API upgrades a "sent" invitation once the guest has opened the link or
// replied (see src/app/api/whatsapp/feed), since that proves it arrived.
//
// "sent" used to read "بانتظار التأكيد", which on a wedding dashboard reads as
// "waiting for the guest to confirm attendance" — a guest who had already
// confirmed still showed it. It is waiting for WhatsApp's receipt, and says so.
const MESSAGE_STATUS = {
  answered: { label: "وصلت — ردّ على الدعوة", chip: "chip-ok" },
  opened: { label: "وصلت — فتح الدعوة", chip: "chip-ok" },
  read: { label: "قرأها الضيف", chip: "chip-ok" },
  delivered: { label: "تم التسليم", chip: "chip-ok" },
  sent: { label: "أُرسلت", chip: "chip-info" },
  simulated: { label: "محاكاة", chip: "chip-warn" },
  failed: { label: "فشل الإرسال", chip: "chip-danger" },
  logged: { label: "مسجَّلة", chip: "chip-neutral" },
};

export function WhatsappFeed({ messages, watiConfigured, onClear }) {
  const [clearing, setClearing] = useState(false);

  async function clear() {
    if (!window.confirm("مسح كل رسائل السجل لهذا الزفاف؟ هذا يمسح السجل بس — ما يلغي أي رسالة انرسلت.")) return;
    setClearing(true);
    try {
      await onClear();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="font-bold">سجلّ رسائل واتساب</h2>
        <div className="flex items-center gap-2">
          {onClear && messages.length > 0 ? (
            <button onClick={clear} disabled={clearing} className="pill-btn-danger pill-btn-sm">
              {clearing ? "جارٍ المسح..." : "مسح السجل"}
            </button>
          ) : null}
          <span
            className="text-xs px-2 py-1 rounded-full font-semibold"
            style={{ background: watiConfigured ? "var(--ok-bg)" : "var(--danger-bg)", color: watiConfigured ? "var(--ok)" : "var(--danger)" }}
          >
            {watiConfigured ? "متصل بـ Wati — إرسال حقيقي" : "غير متصل — محاكاة فقط"}
          </span>
        </div>
      </div>
      <div className="log-scroll">
        {messages.length === 0 && <p className="text-sm text-ink-3 text-center py-6">لا توجد رسائل بعد</p>}
        {messages.map((m) => (
          <div key={m.id} className="log-row">
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium min-w-0 flex-1">{m.content}</span>
              <span className={`chip shrink-0 ${MESSAGE_STATUS[m.status]?.chip || "chip-neutral"}`}>
                {MESSAGE_STATUS[m.status]?.label || m.status}
              </span>
            </div>
            {/* API errors arrive as one long unbroken JSON string, which used
                to run off the side of this narrow panel and get clipped —
                exactly when the text matters most. Forced to wrap, and left
                selectable so it can be copied straight into a bug report. */}
            {m.error && (
              <p
                className="text-danger text-xs mt-1 ltr text-left select-all"
                style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
              >
                {m.error}
              </p>
            )}
            <p className="text-ink-3 text-xs mt-1">{formatDateTimeArabic(m.createdAt)}</p>
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
      <div className="log-scroll">
        {wishes.length === 0 && <p className="text-sm text-ink-3 text-center py-6">لم تصل رسائل تهنئة بعد</p>}
        {wishes.map((g) => (
          <div key={g.id} className="log-row">
            <p className="text-ink leading-relaxed">{g.wishMessage}</p>
            <p className="text-ink-3 text-xs mt-1">
              — {g.name}
              {g.wishMessageAt && <> · {formatDateTimeArabic(g.wishMessageAt)}</>}
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
      <div className="log-scroll">
        {logs.length === 0 && <p className="text-sm text-ink-3 text-center py-6">لا توجد عمليات دخول مسجَّلة بعد</p>}
        {logs.map((l) => (
          <div
            key={l.id}
            className="log-row"
            style={l.ok ? undefined : { borderColor: "var(--danger)", background: "var(--danger-bg)" }}
          >
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium min-w-0 flex-1">{l.guestName || "رمز غير معروف"}</span>
              <span
                className="text-xs shrink-0 px-2 py-0.5 rounded-full font-semibold"
                style={{ background: l.ok ? "var(--ok-bg)" : "var(--danger-bg)", color: l.ok ? "var(--ok)" : "var(--danger)" }}
              >
                {l.ok ? "دخول ناجح" : "مرفوض"}
              </span>
            </div>
            <p className="text-ink-2 text-xs mt-1">{l.message}</p>
            <p className="text-ink-3 text-xs mt-1">
              بواسطة: {l.staffName || "غير معروف"} — {formatDateTimeArabic(l.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
