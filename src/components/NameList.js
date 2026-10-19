"use client";

import { useCallback, useEffect, useState } from "react";
import { PhoneIcon, SearchIcon } from "@/components/icons";

// The door list, as one component wherever it appears.
//
// The couple write it (each their own side, or both from the wedding
// dashboard), and the door reads it — the scanner at the gate and the
// security contact's phone. Same rows, same order, same two columns, so what
// the couple proof-read is what the person on the door is holding.
//
// Written in Gulf Arabic like everything else the couple and their staff see.

const SIDE_LABEL = { groom: "ضيوف العريس", bride: "ضيوف العروس" };

function Row({ entry, onChange, onRemove, busy }) {
  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 min-w-0">
        <input
          value={entry.name}
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
          placeholder="الاسم واسم العائلة"
          className="field w-full"
          aria-label="الاسم واسم العائلة"
        />
        <input
          value={entry.phone || ""}
          onChange={(e) => onChange({ ...entry, phone: e.target.value })}
          placeholder="رقم الجوال (اختياري)"
          className="field w-full mt-1"
          dir="ltr"
          aria-label="رقم الجوال، اختياري"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className="pill-btn-ghost pill-btn-sm"
        style={{ color: "var(--danger)" }}
        aria-label={`حذف ${entry.name || "السطر"}`}
      >
        حذف
      </button>
    </div>
  );
}

function ReadOnlyList({ entries, query }) {
  const shown = query
    ? entries.filter((e) => e.name.includes(query) || (e.phone || "").includes(query))
    : entries;
  if (shown.length === 0) {
    return <p className="meta text-center py-4">{query ? "ما في أحد بهذا الاسم." : "ما في أسماء."}</p>;
  }
  return (
    <ol className="flex flex-col gap-1">
      {shown.map((e, i) => (
        <li
          key={e.id || i}
          className="flex items-baseline justify-between gap-2 py-1.5 border-b last:border-0"
          style={{ borderColor: "var(--line-soft)" }}
        >
          <span className="font-medium">
            <span className="tnum meta ml-2">{i + 1}.</span>
            {e.name}
          </span>
          {e.phone && (
            <a href={`tel:${e.phone}`} className="meta tnum inline-flex items-center gap-1" dir="ltr">
              <PhoneIcon size={13} /> {e.phone}
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

function SidePanel({ side, entries, limit, canWrite, onSave, busy, query }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const editing = draft !== null;

  function start() {
    setError("");
    setDraft(entries.map((e) => ({ ...e })));
  }

  async function save() {
    setError("");
    const problem = await onSave(side, draft.filter((e) => (e.name || "").trim() || (e.phone || "").trim()));
    if (problem) setError(problem);
    else setDraft(null);
  }

  const list = editing ? draft : entries;

  return (
    <div className="card-flat p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{SIDE_LABEL[side]}</h3>
        <span className="chip chip-neutral tnum">
          {list.length} / {limit}
        </span>
      </div>

      {editing ? (
        <>
          <div className="flex flex-col gap-2">
            {draft.map((e, i) => (
              <Row
                key={e.id || i}
                entry={e}
                busy={busy}
                onChange={(next) => setDraft(draft.map((x, j) => (j === i ? next : x)))}
                onRemove={() => setDraft(draft.filter((_, j) => j !== i))}
              />
            ))}
          </div>
          {draft.length < limit && (
            <button
              type="button"
              onClick={() => setDraft([...draft, { name: "", phone: "" }])}
              className="pill-btn-outline pill-btn-sm self-start"
            >
              + إضافة اسم
            </button>
          )}
          <p className="text-xs text-ink-2 leading-relaxed">
            لازم الاسم الأول واسم العائلة — اسم واحد ما يكفي على الباب. الرقم اختياري.
          </p>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={save} className="pill-btn pill-btn-sm flex-1">
              {busy ? "..." : "حفظ"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="pill-btn-ghost pill-btn-sm">
              إلغاء
            </button>
          </div>
        </>
      ) : (
        <>
          <ReadOnlyList entries={entries} query={query} />
          {canWrite && (
            <button type="button" onClick={start} className="pill-btn-outline pill-btn-sm self-start">
              {entries.length ? "تعديل القائمة" : "إضافة أسماء"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * @param eventId   whose list
 * @param sides     which columns to show (default both)
 * @param guardKey  the security contact's key, when there is no session
 * @param printable show the print / PDF buttons
 */
export default function NameList({ eventId, sides, guardKey, printable = false, search = false }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const url = guardKey
    ? `/api/events/${eventId}/name-list?key=${encodeURIComponent(guardKey)}`
    : `/api/events/${eventId}/name-list`;

  const load = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(side, entries) {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/name-list`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, entries }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return json.error || "ما قدرنا نحفظ";
      setData(json);
      return null;
    } catch {
      return "ما قدرنا نوصل للسيرفر";
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="meta">جاري التحميل...</p>;

  const shown = sides?.length ? sides : ["groom", "bride"];
  const pdfUrl = guardKey
    ? `/api/events/${eventId}/name-list/pdf?key=${encodeURIComponent(guardKey)}`
    : `/api/events/${eventId}/name-list/pdf`;

  return (
    <div className="flex flex-col gap-3">
      {search && (
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
      )}

      <div className={shown.length > 1 ? "grid gap-3 md:grid-cols-2" : ""}>
        {shown.map((side) => (
          <SidePanel
            key={side}
            side={side}
            entries={data[side] || []}
            limit={data.limit}
            canWrite={(data.canWrite || []).includes(side)}
            onSave={save}
            busy={busy}
            query={query}
          />
        ))}
      </div>

      {printable && (
        <div className="flex gap-2 flex-wrap">
          {/* One sheet, two columns — the groom's names on the right and the
              bride's on the left, so the door holds one page and not two. */}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="pill-btn-outline pill-btn-sm">
            تنزيل PDF
          </a>
          <a href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}print=1`} target="_blank" rel="noopener noreferrer" className="pill-btn-outline pill-btn-sm">
            طباعة
          </a>
        </div>
      )}
    </div>
  );
}
