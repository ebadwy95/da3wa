"use client";

import { DEFAULT_TIMELINE, TIMELINE_ICONS } from "@/components/Timeline";
import { PlusIcon, XIcon } from "@/components/icons";

// Editing the order of the night from the dashboard.
//
// The programme used to be six lines hard-coded in the component, which meant
// every wedding in the system ran to the same schedule — fine as a default,
// wrong as a fact. Couples start at different hours and not all of them have
// a zaffa.
//
// Empty means "use the default": a couple who never opens this still gets a
// sensible programme, and clearing every row is how you go back to it rather
// than a way to end up with an empty section on the invitation.

const ICON_LABELS = {
  groom: "العريس",
  bride: "العروس",
  dinner: "العشاء",
  zaffa: "الزفة",
  camera: "التصوير",
  fireworks: "الختام",
  star: "نجمة",
};

export function TimelineEditor({ value, onChange }) {
  const rows = Array.isArray(value) && value.length ? value : [];
  const usingDefault = rows.length === 0;
  const shown = usingDefault ? DEFAULT_TIMELINE : rows;

  const edit = (i, patch) =>
    onChange(shown.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <label className="label">برنامج الليلة</label>
      <p className="hint" style={{ marginTop: 0 }}>
        {usingDefault
          ? "هذا هو البرنامج الافتراضي — عدّله ليصبح خاصًا بهذه المناسبة."
          : "احذف كل السطور للعودة إلى البرنامج الافتراضي."}
      </p>

      <div className="flex flex-col gap-2 mt-2">
        {shown.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              value={row.at}
              onChange={(e) => edit(i, { at: e.target.value })}
              className="field tnum"
              style={{ width: "8rem" }}
              aria-label="الوقت"
            />
            <input
              value={row.label}
              onChange={(e) => edit(i, { label: e.target.value })}
              className="field"
              placeholder="مثلاً: دخلة العروس"
              aria-label="الوصف"
            />
            <select
              value={row.icon || "star"}
              onChange={(e) => edit(i, { icon: e.target.value })}
              className="field"
              style={{ width: "8rem" }}
              aria-label="الأيقونة"
            >
              {Object.keys(TIMELINE_ICONS).map((key) => (
                <option key={key} value={key}>
                  {ICON_LABELS[key] || key}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(shown.filter((_, k) => k !== i))}
              className="icon-btn"
              aria-label="حذف السطر"
            >
              <XIcon size={15} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          onChange([...shown, { at: "21:00", label: "", icon: "star" }])
        }
        className="pill-btn-outline pill-btn-sm mt-3"
      >
        <PlusIcon size={14} />
        أضف سطرًا
      </button>
    </div>
  );
}
