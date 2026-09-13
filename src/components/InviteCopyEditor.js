"use client";

import { INVITE_COPY_FIELDS, INVITE_COPY_MAX, defaultInviteCopy } from "@/lib/inviteCopy";

// The wording of the invitation, as a form — for the Arabic card or the
// English one, depending on `lang`.
//
// Every field shows the designed wording as its placeholder rather than as its
// value. That distinction is the whole design of this panel: an empty box with
// the default behind it says "this is what will appear, change it if you like",
// while a box pre-filled with the same text says "you have already customised
// this" and makes clearing it look like deleting the heading. Empty means
// default, here and in resolveInviteCopy.

export function InviteCopyEditor({ value, onChange, lang = "ar" }) {
  const copy = value && typeof value === "object" ? value : {};
  const defaults = defaultInviteCopy(lang);
  const english = lang === "en";
  const changed = INVITE_COPY_FIELDS.filter((f) => (copy[f.key] || "").trim()).length;

  const set = (key, v) => onChange({ ...copy, [key]: v });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="hint" style={{ margin: 0 }}>
          {english
            ? "نصوص النسخة الإنجليزية من الدعوة، اللي بتظهر لأي ضيف لغته English. اترك الخانة فارغة ليظهر النص الإنجليزي الأصلي المكتوب تحتها."
            : "كل سطر مكتوب في الدعوة تقدر تغيّره من هنا. اترك الخانة فارغة ليظهر النص الأصلي المكتوب تحتها."}
        </p>
        {changed > 0 && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="pill-btn-ghost pill-btn-sm"
          >
            رجّع كل النصوص الأصلية ({changed})
          </button>
        )}
      </div>

      {INVITE_COPY_FIELDS.map((f) => {
        const v = copy[f.key] || "";
        const custom = Boolean(v.trim());
        const dir = english || f.ltr ? "ltr" : undefined;
        return (
          <div key={f.key}>
            <label className="label flex items-center gap-2" htmlFor={`copy-${lang}-${f.key}`}>
              {f.label}
              {custom && (
                <span className="chip chip-ok" style={{ fontSize: "var(--text-xs)", padding: ".1rem .5rem" }}>
                  معدّل
                </span>
              )}
            </label>
            {f.multiline ? (
              <textarea
                id={`copy-${lang}-${f.key}`}
                value={v}
                onChange={(e) => set(f.key, e.target.value)}
                rows={f.rows || 2}
                maxLength={INVITE_COPY_MAX}
                placeholder={defaults[f.key]}
                dir={dir}
                className="field"
                style={{ resize: "vertical" }}
              />
            ) : (
              <input
                id={`copy-${lang}-${f.key}`}
                value={v}
                onChange={(e) => set(f.key, e.target.value)}
                maxLength={INVITE_COPY_MAX}
                placeholder={defaults[f.key]}
                dir={dir}
                className="field"
              />
            )}
            {f.hint && <p className="hint">{f.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
