"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatEventDateArabic, formatEventTimeArabic } from "@/lib/date";
import { InviteOpener } from "@/components/InviteOpener";
import { EnvelopeOpener } from "@/components/EnvelopeOpener";
import {
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertIcon,
  MessageIcon,
  HeartIcon,
  StarOrnamentIcon,
  QrIcon,
  InboxIcon,
} from "@/components/icons";

// Arabic counts don't take a plural noun the way English does — "1 مرافقين"
// reads as broken to a native speaker. Singular, dual and plural each need
// their own form.
function companionLimitLabel(n) {
  if (n === 1) return "مرافق واحد";
  if (n === 2) return "مرافقَين";
  if (n <= 10) return `${n} مرافقين`;
  return `${n} مرافقًا`;
}

// The invitation is the only surface a couple can restyle — the dashboards
// stay light because they're tools. `invite-dark` just redefines the colour
// tokens, so nothing inside has to know which theme it's rendering in.
function PageShell({ children, theme = "light" }) {
  return (
    <main
      className={`min-h-screen flex flex-col items-center p-5 gap-4${theme === "dark" ? " invite-dark" : ""}`}
    >
      {children}
    </main>
  );
}

function LoadingCard() {
  return (
    <PageShell>
      <div className="card max-w-md w-full p-8 flex flex-col items-center gap-4">
        <div className="da3wa-pulse" style={{ color: "var(--gold-300)" }}>
          <StarOrnamentIcon size={32} />
        </div>
        <p className="meta">جارٍ فتح الدعوة...</p>
      </div>
    </PageShell>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [state, setState] = useState({ loading: true, error: null, guest: null, event: null });
  const [companions, setCompanions] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [wishText, setWishText] = useState("");
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishError, setWishError] = useState("");
  const [tab, setTab] = useState("invite"); // invite | wall
  const [wishes, setWishes] = useState([]);
  const [wishesLoading, setWishesLoading] = useState(false);
  // Drives the staged reveal: the card only animates in once the cover has
  // lifted, so the two never play over each other.
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/guests/${id}?t=${encodeURIComponent(token || "")}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطأ");
        return data;
      })
      .then(({ guest, event }) => {
        setState({ loading: false, error: null, guest, event });
        setCompanions(guest.confirmedCompanions || 0);
        setWishText(guest.wishMessage || "");
      })
      .catch((err) => setState({ loading: false, error: err.message, guest: null, event: null }));
  }, [id, token]);

  useEffect(() => {
    if (tab !== "wall" || !state.event) return;
    setWishesLoading(true);
    fetch(`/api/events/${state.event.id}/wishes?guestId=${id}&t=${encodeURIComponent(token || "")}`)
      .then((res) => res.json())
      .then((data) => setWishes(data.wishes || []))
      .finally(() => setWishesLoading(false));
  }, [tab, state.event, id, token]);

  async function respond(attending) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/guests/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, attending, companions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      setState((s) => ({ ...s, guest: data.guest }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendWish() {
    setWishSubmitting(true);
    setWishError("");
    try {
      const res = await fetch(`/api/guests/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: wishText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      setState((s) => ({ ...s, guest: data.guest }));
    } catch (err) {
      setWishError(err.message);
    } finally {
      setWishSubmitting(false);
    }
  }

  if (state.loading) return <LoadingCard />;

  if (state.error) {
    return (
      <PageShell>
        <div className="card max-w-sm w-full p-8 text-center flex flex-col items-center gap-3">
          <span style={{ color: "var(--danger)" }}>
            <AlertIcon size={32} />
          </span>
          <p style={{ color: "var(--danger)", fontWeight: 600 }}>{state.error}</p>
          <p className="meta">
            لو الرابط وصلك من العروسين، تواصل معهم للحصول على رابط جديد.
          </p>
        </div>
      </PageShell>
    );
  }

  const { guest, event } = state;
  const prettyDate = formatEventDateArabic(event.eventDate);
  const prettyTime = formatEventTimeArabic(event.eventTime);
  // A film, if the couple has one. Otherwise the envelope — which every
  // invitation gets, because arriving straight at the card skips the one
  // moment the whole thing is about.
  const hasFilm = Boolean(event.inviteVideoUrl);
  const hasOpener = true;

  return (
    <PageShell theme={event.inviteTheme}>
      {hasFilm ? (
        <InviteOpener
          videoUrl={event.inviteVideoUrl}
          posterUrl={event.invitePosterUrl}
          audioUrl={event.inviteAudioUrl}
          coupleNames={event.coupleNames}
          onOpened={() => setOpened(true)}
        />
      ) : (
        <EnvelopeOpener
          audioUrl={event.inviteAudioUrl || "/samples/music.mp3"}
          eyebrow={`أهلًا ${guest.name}`}
          title={event.coupleNames}
          cta="افتح دعوتك"
          onOpened={() => setOpened(true)}
        />
      )}

      <div className="tab-switch" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "invite"}
          data-active={tab === "invite"}
          onClick={() => setTab("invite")}
        >
          الدعوة
        </button>
        <button
          role="tab"
          aria-selected={tab === "wall"}
          data-active={tab === "wall"}
          onClick={() => setTab("wall")}
        >
          رسائل التهنئة
        </button>
      </div>

      {tab === "invite" ? (
        <article
          className={
            "card-ornate invite-card max-w-md w-full p-8 text-center flex flex-col gap-5 " +
            (hasOpener ? (opened ? "rise" : "invisible") : "da3wa-fade-in")
          }
        >
          <div className="ornament-divider" aria-hidden="true">
            <StarOrnamentIcon size={14} />
          </div>

          {/* Aref Ruqaa is a calligraphic face — its letterforms need more
              size and leading than a UI font at the same optical weight, or
              the strokes collide and the line stops being readable. */}
          <p
            className="font-display"
            style={{ color: "var(--gold-600)", fontSize: "var(--text-xl)", lineHeight: 1.85 }}
          >
            بسم الله نبدأ فرحتنا، وبالحب نكتب أجمل بدايات العمر
          </p>

          <h1 className="font-display" style={{ fontSize: "var(--text-4xl)", color: "var(--ink)" }}>
            {event.coupleNames}
          </h1>

          {prettyDate && (
            <p className="meta" style={{ letterSpacing: "0.04em" }}>
              {prettyDate}
              {prettyTime && ` — ${prettyTime}`}
            </p>
          )}

          <div className="ornament-divider" aria-hidden="true">
            <StarOrnamentIcon size={14} />
          </div>

          <h2 className="title" style={{ color: "var(--gold-600)" }}>
            أهلًا {guest.name}
          </h2>
          <p className="body">{event.welcomeMessage}</p>

          {/* The date already sits under the couple's names above, where it
              belongs ceremonially — repeating it here just made the card look
              like a form. This block is the practical "where" detail only. */}
          {event.venueName && (
            <div
              className="flex flex-col gap-2.5 py-4 text-right"
              style={{ borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}
            >
              {event.venueName && (
                <p className="flex items-center gap-2.5" style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--gold-500)" }}><MapPinIcon size={18} /></span>
                  {event.venueName}
                </p>
              )}
              {event.venueMapUrl && (
                <a
                  href={event.venueMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-btn-outline pill-btn-sm self-start mt-1"
                >
                  <MapPinIcon size={15} />
                  اعرض الموقع على الخريطة
                </a>
              )}
            </div>
          )}

          {guest.status === "pending" && (
            <div className="flex flex-col gap-4">
              {guest.maxCompanions > 0 && (
                <div className="text-right">
                  <label htmlFor="companions" className="label">
                    عدد المرافقين معك
                  </label>
                  <select
                    id="companions"
                    value={companions}
                    onChange={(e) => setCompanions(Number(e.target.value))}
                    className="field tnum"
                  >
                    {Array.from({ length: guest.maxCompanions + 1 }, (_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                  <p className="hint">بحد أقصى {companionLimitLabel(guest.maxCompanions)}</p>
                </div>
              )}
              {/* Stacked rather than side by side: at 375px two pill buttons
                  force the primary label onto a second line, and confirming
                  is the action almost everyone came here to take. */}
              <div className="flex flex-col gap-2.5">
                <button
                  disabled={submitting}
                  onClick={() => respond(true)}
                  className="pill-btn w-full whitespace-nowrap"
                >
                  <CheckCircleIcon size={18} />
                  {submitting ? "جارٍ التأكيد..." : "أكّد الحضور"}
                </button>
                <button
                  disabled={submitting}
                  onClick={() => respond(false)}
                  className="pill-btn-outline w-full"
                >
                  أعتذر عن الحضور
                </button>
              </div>
            </div>
          )}

          {guest.status === "confirmed" && (
            <div className="flex flex-col gap-4" aria-live="polite">
              <p
                className="chip chip-ok self-center"
                style={{ fontSize: "var(--text-sm)", padding: "0.4rem 0.9rem" }}
              >
                <CheckCircleIcon size={16} />
                تم تأكيد حضورك
                {guest.confirmedCompanions ? ` مع ${guest.confirmedCompanions} من المرافقين` : ""}
              </p>

              {guest.qrDataUrl ? (
                <figure className="flex flex-col items-center gap-2 m-0">
                  <div
                    className="p-3 rounded-2xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={guest.qrDataUrl}
                      alt={`رمز الدخول الخاص بـ ${guest.name}`}
                      className="rounded-xl block"
                      width={280}
                      height={280}
                      style={{ width: "100%", maxWidth: 280, height: "auto" }}
                    />
                  </div>
                  <figcaption className="meta flex items-center gap-2">
                    <QrIcon size={15} />
                    أظهر الرمز للموظف عند الباب — وصلتك نسخة على واتساب
                  </figcaption>
                </figure>
              ) : (
                <p className="meta da3wa-pulse">جارٍ تجهيز رمز الدخول...</p>
              )}
            </div>
          )}

          {guest.status === "declined" && (
            <p className="flex items-center justify-center gap-2 body" aria-live="polite">
              <span style={{ color: "var(--ink-3)" }}><XCircleIcon size={18} /></span>
              تم تسجيل اعتذارك، نتمنى أن نراك في مناسبة أخرى
            </p>
          )}

          {guest.status !== "pending" && (
            <div
              className="text-right flex flex-col gap-2 pt-5"
              style={{ borderTop: "1px solid var(--line-soft)" }}
            >
              <label htmlFor="wish" className="label flex items-center gap-2">
                <span style={{ color: "var(--gold-500)" }}><MessageIcon size={16} /></span>
                {guest.wishMessage ? "تعديل رسالتك للعروسين" : "اترك رسالة تهنئة للعروسين"}
              </label>
              <textarea
                id="wish"
                value={wishText}
                onChange={(e) => setWishText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="اكتب هنا رسالتك أو تهنئتك..."
                className="field"
                aria-invalid={wishError ? "true" : undefined}
                style={{ resize: "vertical" }}
              />
              {/* ltr so the counter reads "66 / 500" and not "500 / 66" —
                  a slash-separated pair gets reordered by the bidi algorithm
                  inside an RTL paragraph. */}
              <p className="hint tnum ltr text-left">{wishText.length} / 500</p>
              {wishError && <p className="error">{wishError}</p>}
              <button
                onClick={sendWish}
                disabled={wishSubmitting || !wishText.trim()}
                className="pill-btn w-full"
              >
                {wishSubmitting
                  ? "جارٍ الإرسال..."
                  : guest.wishMessage
                    ? "تحديث الرسالة"
                    : "إرسال الرسالة"}
              </button>
              {guest.wishMessage && (
                <p
                  className="flex items-center gap-2"
                  style={{ fontSize: "var(--text-xs)", color: "var(--ok)" }}
                  aria-live="polite"
                >
                  <CheckCircleIcon size={14} />
                  تم إرسال رسالتك، ويمكنك تعديلها في أي وقت.
                </p>
              )}
            </div>
          )}
        </article>
      ) : (
        <section className="wall-section max-w-md w-full p-5 da3wa-fade-in">
          <h2
            className="font-display text-center mb-1 flex items-center justify-center gap-2"
            style={{ fontSize: "var(--text-2xl)", color: "var(--gold-300)" }}
          >
            <HeartIcon size={20} />
            رسائل التهنئة
          </h2>
          <p
            className="text-center mb-4"
            style={{ fontSize: "var(--text-xs)", color: "rgba(243,237,224,0.55)" }}
          >
            من كل من شارك العروسين فرحتهم
          </p>

          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
            {wishesLoading && (
              <p className="text-center py-8 da3wa-pulse" style={{ color: "rgba(243,237,224,0.6)" }}>
                جارٍ التحميل...
              </p>
            )}

            {!wishesLoading && wishes.length === 0 && (
              <div className="empty" style={{ color: "rgba(243,237,224,0.65)" }}>
                <span style={{ color: "var(--gold-400)" }}><InboxIcon size={30} /></span>
                <p style={{ fontSize: "var(--text-sm)" }}>
                  لم تصل رسائل تهنئة بعد — كن أول من يهنّئ العروسين
                </p>
              </div>
            )}

            {wishes.map((w, i) => (
              <div key={i} className="wish-card p-3 flex items-start gap-3">
                <span className="avatar-circle" style={{ fontSize: "var(--text-sm)" }}>
                  {w.name?.trim()?.[0] || "؟"}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--gold-300)" }}>
                    {w.name}
                  </p>
                  <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7, marginTop: "0.15rem" }}>
                    {w.wishMessage}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
