"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatEventDateArabic, formatEventTimeArabic } from "@/lib/date";
import { InviteOpener } from "@/components/InviteOpener";
import { EnvelopeOpener } from "@/components/EnvelopeOpener";
import { Countdown } from "@/components/Countdown";
import { Reveal } from "@/components/Reveal";
import { Timeline } from "@/components/Timeline";
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
  // The couple can set their own; otherwise nothing is shown rather than a
  // transliteration guessed from Arabic, which gets names wrong more often
  // than it gets them right.
  const latinNames = event.latinNames || "";

  // The "AT" block is set in Latin, so the time is too — 8:00 PM rather than
  // ٨:٠٠ مساءً, which is what prettyTime gives and what the Arabic sections
  // above use.
  // The weekday and date in Latin, to sit with the time under "AT".
  const latinDate = (() => {
    if (!event.eventDate) return "";
    const d = new Date(`${event.eventDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  })();

  const latinTime = (() => {
    if (!/^\d{2}:\d{2}$/.test(event.eventTime || "")) return "";
    const [h, m] = event.eventTime.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
  })();
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
            "inv invite-card w-full " + (opened ? "da3wa-fade-in" : "invisible")
          }
        >
          {/* The order Eslam specified: date, the names in Latin, the
              dedication, the families' line, the names in Arabic, then the
              time and the venue. */}
          <Reveal className="inv-sec pad">
            <div className="ornament-divider" aria-hidden="true">
              <StarOrnamentIcon size={14} />
            </div>
            {event.eventDate && (
              /* dir=ltr, or the RTL paragraph reorders the groups and
                 23.10.2026 is rendered as 2026.10.23. */
              <p className="inv-date" dir="ltr" style={{ marginTop: "1.4rem" }}>
                {event.eventDate.split("-").reverse().join(" . ")}
              </p>
            )}
          </Reveal>

          {latinNames && (
            <Reveal className="inv-sec" delay={60}>
              <p className="inv-latin" dir="ltr">{latinNames}</p>
            </Reveal>
          )}

          <div className="inv-rule" aria-hidden="true" />

          <Reveal className="inv-sec pad" delay={60}>
            <p className="body" style={{ lineHeight: 2.1 }}>
              إلى كل من نال في قلبنا مكانًا
            </p>
            <p className="body" style={{ lineHeight: 2.1, marginTop: "1.1rem" }}>
              تتشرّف {event.familyNames || "عائلة بدوي وعائلة عطّاري"} بدعوتكم
              لحضور حفل زفاف نجليهما
            </p>

            <h1
              className="font-display"
              style={{
                fontSize: "clamp(2.4rem, 11vw, 3.4rem)",
                lineHeight: 1.6,
                color: "var(--ink)",
                marginTop: "1.4rem",
              }}
            >
              {event.coupleNames}
            </h1>
          </Reveal>

          {latinTime && (
            <>
              <div className="inv-rule" aria-hidden="true" />
              <Reveal className="inv-sec pad" delay={60}>
                <p className="inv-eyebrow" dir="ltr" style={{ letterSpacing: "0.3em" }}>AT</p>
                <p className="inv-latin" dir="ltr" style={{ fontSize: "var(--text-2xl)" }}>
                  {latinTime}
                </p>
                {latinDate && (
                  <p
                    className="meta"
                    dir="ltr"
                    style={{ letterSpacing: "0.14em", marginTop: ".7rem" }}
                  >
                    {latinDate}
                  </p>
                )}
              </Reveal>
            </>
          )}

          {event.venueName && (
            <>
              <div className="inv-rule" aria-hidden="true" />
              <Reveal className="inv-sec pad" delay={60}>
                <p className="inv-eyebrow">المكان</p>
                <p
                  className="font-display"
                  style={{ fontSize: "var(--text-xl)", lineHeight: 1.75, color: "var(--ink)" }}
                >
                  {event.venueName}
                </p>
                {event.venueMapUrl && (
                  <a
                    href={event.venueMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pill-btn-outline pill-btn-sm"
                    style={{ marginTop: "1.1rem" }}
                  >
                    <MapPinIcon size={15} />
                    اعرض الموقع على الخريطة
                  </a>
                )}
              </Reveal>
            </>
          )}

          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            <p className="inv-eyebrow">برنامج الليلة</p>
            <Timeline date={event.eventDate} />
          </Reveal>

          {/* Only while there is something to count down to — after the night
              it would sit at zero, which is a worse thing to show than
              nothing at all. */}
          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            <p className="inv-eyebrow">باقي على الليلة</p>
            <Countdown date={event.eventDate} time={event.eventTime} />
          </Reveal>

          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            {guest.status === "pending" && (
              <p className="inv-eyebrow">حضورك يسعدنا</p>
            )}

          {guest.status === "pending" && (
            <div className="flex flex-col gap-4">
              {guest.maxCompanions > 0 && (
                <div>
                  {/* The allowance stated before the question. A bare "عدد
                      المرافقين" makes the guest guess how many they are
                      allowed to bring, and guessing high is the awkward
                      outcome at the door. */}
                  <p className="body" style={{ marginBottom: "1.1rem" }}>
                    دعوتك تشمل{" "}
                    <strong style={{ color: "var(--gold-600)" }}>
                      {guest.maxCompanions + 1} أفراد
                    </strong>{" "}
                    — أنت و{companionLimitLabel(guest.maxCompanions)}.
                    <br />
                    <span className="meta">كم فردًا سيحضر؟</span>
                  </p>

                  {/* Chips rather than a dropdown: at most a handful of
                      options, and a select hides them behind a tap. */}
                  <div className="seat-pick" role="radiogroup" aria-label="عدد الحاضرين">
                    {Array.from({ length: guest.maxCompanions + 1 }, (_, i) => {
                      const total = i + 1;
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={companions === i}
                          data-on={companions === i}
                          onClick={() => setCompanions(i)}
                        >
                          <span className="tnum">{total}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="hint" style={{ textAlign: "center" }}>
                    {companions === 0
                      ? "أنت فقط"
                      : `أنت و${companionLimitLabel(companions)}`}
                  </p>
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
          </Reveal>

          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            <p
              className="font-display"
              style={{ color: "var(--gold-600)", fontSize: "var(--text-xl)", lineHeight: 1.9, marginBottom: "1.4rem" }}
            >
              كلماتكم هدية تدوم مدى العمر
            </p>

            <div className="text-right flex flex-col gap-2">
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
          </Reveal>

          {/* The invitation ends on the name of the person it was written
              for. */}
          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={80}>
            <p className="inv-eyebrow">دعوة خاصة بـ</p>
            <p
              className="font-display"
              style={{ color: "var(--ink)", fontSize: "var(--text-2xl)", lineHeight: 1.7 }}
            >
              {guest.name}
            </p>
            <div className="ornament-divider" style={{ marginTop: "1.4rem" }} aria-hidden="true">
              <StarOrnamentIcon size={14} />
            </div>
          </Reveal>
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
