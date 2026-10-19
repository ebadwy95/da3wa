"use client";

import { useEffect, useState } from "react";

// Practice passes, shown big enough to scan off this screen.
//
// The drill is two phones: this one holds up a code, the scanner reads it.
// Nothing here touches the wedding's data — the check-in endpoint recognises
// these before it looks anything up — so the team can run it as many times as
// they like, on the real scanner, the week before.
export default function TrainingCodes({ eventId, guardKey }) {
  const [codes, setCodes] = useState(null);

  useEffect(() => {
    const url = guardKey
      ? `/api/events/${eventId}/training?key=${encodeURIComponent(guardKey)}`
      : `/api/events/${eventId}/training`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCodes(j?.codes || []))
      .catch(() => setCodes([]));
  }, [eventId, guardKey]);

  if (!codes) return <p className="meta">جاري التحميل...</p>;
  if (codes.length === 0) return <p className="meta">ما قدرنا نجيب بطاقات التدريب.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-2 leading-relaxed">
        افتح هذي الصفحة على جوال، وخلّ موظف الباب يمسح كل بطاقة بالسكانر ويشوف الردّ. هذي بطاقات
        تدريب — ما تدخل أحد وما تغيّر أي شي في بيانات العرس.
      </p>
      {codes.map((c) => (
        <div key={c.variant} className="card-flat p-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.qr} alt={c.label} width={110} height={110} style={{ borderRadius: "0.5rem" }} />
          <div className="min-w-0">
            <p className="font-bold">{c.label}</p>
            <p className="text-xs text-ink-2 leading-relaxed">{c.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
