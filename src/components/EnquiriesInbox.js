"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeArabic } from "@/lib/date";
import { InboxIcon, PhoneIcon, UsersIcon, CalendarIcon, MessageIcon } from "@/components/icons";

// Requests coming in from the public form at /start.
//
// This is where a lead actually lands: the enquiry is written to the database
// before the notification email is attempted precisely so a mail problem never
// loses one. Without somewhere to read them, that guarantee was theoretical.

export function EnquiriesInbox() {
  const [enquiries, setEnquiries] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEnquiries = useCallback(
    () =>
      fetch("/api/enquiries")
        .then((res) => res.json())
        .then((d) => setEnquiries(d.enquiries || []))
        .catch(() => setEnquiries([]))
        .finally(() => setLoading(false)),
    []
  );

  const reload = useCallback(() => {
    setLoading(true);
    fetchEnquiries();
  }, [fetchEnquiries]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  if (loading && enquiries === null) return null;
  const items = enquiries || [];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-bold flex items-center gap-2">
          <InboxIcon size={18} />
          طلبات جديدة
          {items.length > 0 && <span className="chip chip-gold tnum">{items.length}</span>}
        </h2>
        <button onClick={reload} disabled={loading} className="pill-btn-ghost pill-btn-sm">
          {loading ? "..." : "تحديث"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <InboxIcon size={30} />
          <p style={{ fontSize: "var(--text-sm)" }}>
            لا توجد طلبات بعد — تصل هنا من صفحة «ابدأ الآن».
          </p>
        </div>
      ) : (
        <div className="log-scroll">
          {items.map((e) => (
            <div key={e.id} className="log-row">
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <span className="font-medium min-w-0 flex-1">{e.name}</span>
                <span className="chip chip-gold">{e.eventTypeLabel}</span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5" style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                {/* tel: so a phone can dial it, and ltr so the number isn't
                    reordered by the surrounding Arabic. */}
                <a href={`tel:${e.phone}`} className="flex items-center gap-1.5 ltr" dir="ltr">
                  <PhoneIcon size={14} />
                  {e.phone}
                </a>
                {e.guestCount && (
                  <span className="flex items-center gap-1.5 tnum">
                    <UsersIcon size={14} />
                    {e.guestCount} ضيف
                  </span>
                )}
                {e.eventDate && (
                  <span className="flex items-center gap-1.5 tnum ltr" dir="ltr">
                    <CalendarIcon size={14} />
                    {e.eventDate}
                  </span>
                )}
                {e.email && (
                  <a href={`mailto:${e.email}`} className="flex items-center gap-1.5 ltr" dir="ltr">
                    <MessageIcon size={14} />
                    {e.email}
                  </a>
                )}
              </div>

              {e.notes && (
                <p className="mt-1.5" style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                  {e.notes}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2">
                <a
                  href={`https://wa.me/${String(e.phone).replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-btn-outline pill-btn-sm"
                >
                  ردّ على واتساب
                </a>
                <span className="hint m-0">{formatDateTimeArabic(e.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
