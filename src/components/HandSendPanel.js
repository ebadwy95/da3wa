"use client";

import { useMemo, useState } from "react";
import { CheckCircleIcon, ChevronDownIcon, XCircleIcon } from "@/components/icons";

// Sending the invitations by hand, from the couple's own WhatsApp.
//
// This exists because the WhatsApp Business API is a delivery route, not the
// product, and that route can be closed for weeks at a time — Meta's business
// verification has taken more than ten days here with no answer. Everything
// that makes this thing worth paying for (a personal link per guest, the RSVP,
// the code on the door) works regardless of how the link reaches the guest.
//
// It uses WhatsApp's own click-to-chat links, which is the one sanctioned way
// to hand WhatsApp a pre-written message without an API. No automation library,
// no unofficial client, nothing that risks the number being banned — the couple
// taps send themselves, which is also why the message arrives from a number
// their guests recognise instead of from a business account.
//
// One guest at a time on purpose. A list of two hundred rows means finding
// your place again after every send; a single card that always shows the next
// unsent guest means the job is the same two taps, two hundred times.

function waLink(phone, text) {
  const digits = String(phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function HandSendPanel({ event, guests, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastSent, setLastSent] = useState(null);

  const pending = useMemo(() => guests.filter((g) => !g.invitedAt), [guests]);
  const done = guests.length - pending.length;
  const current = pending[0];

  // The message in the guest's language, same as the card it links to. An
  // English guest who receives an Arabic message may never open the link.
  const message = (guest) =>
    guest.language === "en"
      ? [
          `Hello ${guest.name} 🤍`,
          "",
          `We would be honoured to have you at the wedding of ${event?.latinNames || event?.coupleNames || ""}.`,
          "",
          "Your personal invitation is here — you can confirm your attendance from the same link:",
          guest.inviteLink,
        ].join("\n")
      : [
          `أهلًا ${guest.name} 🤍`,
          "",
          `يشرّفنا دعوتكم لحضور حفل زفاف ${event?.coupleNames || ""}.`,
          "",
          "دعوتكم الخاصة من هنا — وتقدروا تأكدوا حضوركم من نفس الرابط:",
          guest.inviteLink,
        ].join("\n");

  async function mark(guest, sent) {
    setBusy(true);
    try {
      await fetch(`/api/events/${event.id}/guests/mark-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: guest.id, sent }),
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function send(guest) {
    // Opened before the request, not after: a popup that opens inside an await
    // has lost the user gesture that permits it, and the browser blocks it.
    window.open(waLink(guest.phoneDisplay || guest.phone, message(guest)), "_blank", "noopener");
    setLastSent(guest);
    await mark(guest, true);
  }

  if (!event || guests.length === 0) return null;

  return (
    <section className="card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full gap-3 text-right"
      >
        <span>
          <h2 className="font-bold">إرسال الدعوات من واتساب العروسين</h2>
          <p className="hint" style={{ margin: 0 }}>
            من غير أي ربط — الرسالة تطلع من رقمكم أنتم، والضيف يعرف الرقم.
          </p>
        </span>
        <span className="flex items-center gap-3 shrink-0">
          <span className="chip tnum" dir="ltr">
            {done} / {guests.length}
          </span>
          <span style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
            <ChevronDownIcon size={16} />
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--line-soft)" }}
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={guests.length}
          >
            <div
              style={{
                width: `${guests.length ? (done / guests.length) * 100 : 0}%`,
                height: "100%",
                background: "var(--gold-500)",
                transition: "width .3s ease",
              }}
            />
          </div>

          {current ? (
            <div
              className="p-4 rounded-2xl flex flex-col gap-3"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              <div>
                <p className="hint" style={{ margin: 0 }}>
                  التالي — باقي {pending.length}
                </p>
                <p className="font-bold flex items-center gap-2 flex-wrap" style={{ fontSize: "var(--text-xl)" }}>
                  {current.name}
                  {current.language === "en" && (
                    <span className="chip chip-info" lang="en" style={{ fontSize: "var(--text-xs)" }}>
                      English
                    </span>
                  )}
                </p>
                <p className="meta tnum" dir="ltr">
                  {current.phoneDisplay || current.phone}
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => send(current)}
                className="pill-btn w-full"
              >
                افتح واتساب وابعت الدعوة
              </button>
              <p className="hint" style={{ textAlign: "center", margin: 0 }}>
                واتساب حيفتح والرسالة مكتوبة جاهزة — اضغط إرسال، وارجع هنا للي بعده.
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={() => mark(current, true)}
                className="pill-btn-ghost pill-btn-sm self-center"
              >
                تخطّي — أرسلتها من مكان تاني
              </button>
            </div>
          ) : (
            <div
              className="p-5 rounded-2xl text-center flex flex-col items-center gap-2"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              <span style={{ color: "var(--ok)" }}>
                <CheckCircleIcon size={26} />
              </span>
              <p className="font-bold">تم إرسال الدعوة لكل الضيوف</p>
              <p className="hint" style={{ margin: 0 }}>
                أي ضيف تضيفوه بعد كده حيظهر هنا لوحده.
              </p>
            </div>
          )}

          {/* Marked the moment the guest is handed to WhatsApp, which is a
              guess — this is how you take it back without hunting through the
              table for the row. */}
          {lastSent && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="meta" style={{ margin: 0 }}>
                آخر واحد: <strong>{lastSent.name}</strong>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await mark(lastSent, false);
                  setLastSent(null);
                }}
                className="pill-btn-ghost pill-btn-sm"
              >
                <XCircleIcon size={14} />
                ما اتبعتتش — رجّعها
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
