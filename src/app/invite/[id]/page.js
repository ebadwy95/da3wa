"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { InviteOpener } from "@/components/InviteOpener";
import { EnvelopeOpener } from "@/components/EnvelopeOpener";
import { Countdown } from "@/components/Countdown";
import { Reveal } from "@/components/Reveal";
import { BrandLoader } from "@/components/BrandLoader";
import { normaliseInviteLanguage, resolveInviteCopy, splitLines } from "@/lib/inviteCopy";
import { inviteUi } from "@/lib/inviteUi";
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

// The two families, one either side of the join.
//
// Stored as one line ("عائلة بدوي وعائلة عطاري") because that is how a couple
// writes it and how it reads in a sentence — but on the card Eslam wants them
// set apart, one leaning in from each side. So the line is parsed rather than
// the model being split in two: a couple should not have to fill in two fields
// to get a sentence they already know how to write.
//
// Returns null when there is only one name, and the sentence form is used
// instead. Guessing a split that is not there is worse than not splitting.
function splitFamilies(raw, lang) {
  const t = (raw || "").trim();
  if (!t) return null;
  // An explicit bar wins, for a name that genuinely contains a waw or an "and".
  const bar = t.split("|").map((x) => x.trim()).filter(Boolean);
  if (bar.length === 2) return bar;
  if (lang === "en") {
    // "The Badwy Family & The Attari Family", or with "and".
    const m = t.match(/^(.+?)\s+(?:&|and)\s+(.+)$/i);
    return m ? [m[1].trim(), m[2].trim()] : null;
  }
  // "عائلة بدوي وعائلة عطاري" — the waw is prefixed to the second family, so
  // it is the space before it that marks the join, not a space after.
  const m = t.match(/^(.+?)\s+و\s*(عائلة|عائله|آل|ال|بيت|أسرة|اسرة)\s+(.+)$/);
  if (m) return [m[1].trim(), `${m[2]} ${m[3]}`.trim()];
  const m2 = t.match(/^(.+?)\s+و\s+(.+)$/);
  if (m2) return [m2[1].trim(), m2[2].trim()];
  return null;
}

// The invitation is the only surface a couple can restyle — the dashboards
// stay light because they're tools. `invite-dark` just redefines the colour
// tokens, so nothing inside has to know which theme it's rendering in.
//
// The page is Arabic and right-to-left everywhere else, so an English card has
// to say so itself: `dir` flips the layout, and `inv-en` swaps the Arabic-only
// display face for one that has Latin letters (see globals.css).
function PageShell({ children, theme = "light", lang = "ar" }) {
  const english = lang === "en";
  return (
    <main
      lang={english ? "en" : "ar"}
      dir={english ? "ltr" : "rtl"}
      className={`min-h-screen flex flex-col items-center p-5 gap-4${theme === "dark" ? " invite-dark" : ""}${english ? " inv-en" : ""}`}
    >
      {children}
    </main>
  );
}

function LoadingCard({ lang }) {
  return (
    <PageShell lang={lang}>
      {/* No "جارٍ فتح الدعوة…" here. The first frame of a wedding invitation
          should not be a progress message — the mark draws itself instead. */}
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
        <BrandLoader />
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

  // The language is the guest's, set by the couple before sending. `?lang=`
  // overrides it — that is how the dashboard previews the other card, and how
  // a guest who was sent the wrong one switches.
  const [lang, setLang] = useState(() => normaliseInviteLanguage(searchParams.get("lang")));
  const [state, setState] = useState({ loading: true, error: null, guest: null, event: null, language: null });
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

  const load = useCallback(
    (requested) => {
      const q = `t=${encodeURIComponent(token || "")}${requested ? `&lang=${requested}` : ""}`;
      return fetch(`/api/guests/${id}?${q}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "خطأ");
          return data;
        })
        .then(({ guest, event, language }) => {
          // Switching language replaces the content without going back through
          // the loading state, which would put the envelope up a second time.
          setState({ loading: false, error: null, guest, event, language: language === "en" ? "en" : "ar" });
          setCompanions(guest.confirmedCompanions || 0);
          setWishText(guest.wishMessage || "");
        })
        .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
    },
    [id, token]
  );

  useEffect(() => {
    if (!id) return;
    load(lang);
  }, [id, lang, load]);

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

  if (state.loading) return <LoadingCard lang={lang} />;

  if (state.error && !state.guest) {
    const ui = inviteUi(lang);
    return (
      <PageShell lang={lang}>
        <div className="card max-w-sm w-full p-8 text-center flex flex-col items-center gap-3">
          <span style={{ color: "var(--danger)" }}>
            <AlertIcon size={32} />
          </span>
          <p style={{ color: "var(--danger)", fontWeight: 600 }}>{state.error}</p>
          <p className="meta">{ui.errorHelp}</p>
        </div>
      </PageShell>
    );
  }

  const { guest, event } = state;
  const language = state.language;
  const english = language === "en";
  const ui = inviteUi(language);
  // A film, if the couple has one. Otherwise the envelope — which every
  // invitation gets, because arriving straight at the card skips the one
  // moment the whole thing is about.
  const hasFilm = Boolean(event.inviteVideoUrl);
  // The couple can set their own; otherwise nothing is shown rather than a
  // transliteration guessed from Arabic, which gets names wrong more often
  // than it gets them right.
  const latinNames = event.latinNames || "";
  // Split on the ampersand so it can be set on its own line and given the
  // motion — it is the one glyph on the card that stands for the two of them
  // together. A name without one is set whole rather than guessed at.
  const latinPair = (() => {
    const parts = latinNames.split("&").map((x) => x.trim()).filter(Boolean);
    return parts.length === 2 ? parts : null;
  })();
  // The endpoint sends the family names in the card's language. The English
  // card has no invented fallback names: without English ones written, it
  // says "the families of the bride and groom", which is true of every
  // wedding.
  const familyLine = english ? event.familyNames || "" : event.familyNames || "عائلة بدوي وعائلة عطاري";
  const families = splitFamilies(familyLine, language);
  // Resolved rather than read straight off the event: the endpoint already
  // sends the merged copy, but an older cached response or a direct call would
  // otherwise render a card with holes in it.
  const copy = resolveInviteCopy(event.inviteCopy, language);
  // The couple's names under the invitation line, with the same ampersand
  // treatment as the Latin ones above so the two settings rhyme. On the Arabic
  // card they are the Arabic names split on a free-standing waw; on the English
  // card, the English names.
  const namesPair = english
    ? latinPair
    : (() => {
        const m = (event.coupleNames || "").match(/^(.+?)\s+و\s+(.+)$/);
        return m ? [m[1].trim(), m[2].trim()] : null;
      })();
  const namesWhole = english ? latinNames || event.coupleNames : event.coupleNames;
  // The name on the envelope, in the script the guest can read.
  const coverNames = english ? latinNames || event.coupleNames : event.coupleNames;

  // The "AT" block is set in Latin on both cards, so the time is too — 8:00
  // PM rather than ٨:٠٠ مساءً.
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

  return (
    <PageShell theme={event.inviteTheme} lang={language}>
      {hasFilm ? (
        <InviteOpener
          videoUrl={event.inviteVideoUrl}
          posterUrl={event.invitePosterUrl}
          audioUrl={event.inviteAudioUrl}
          coupleNames={coverNames}
          guestName={guest.name}
          copy={copy}
          ui={ui}
          onOpened={() => setOpened(true)}
        />
      ) : (
        <EnvelopeOpener
          audioUrl={event.inviteAudioUrl || "/samples/music.mp3"}
          eyebrow={ui.envelopeEyebrow(guest.name)}
          title={coverNames}
          cta={ui.envelopeCta}
          hint={ui.envelopeHint}
          onOpened={() => setOpened(true)}
        />
      )}

      {/* The other language, one tap away. Small and quiet: almost every guest
          already has the right card, and this is for the one who does not. */}
      <button
        type="button"
        onClick={() => setLang(ui.switchToLang)}
        lang={ui.switchToLang}
        className="pill-btn-ghost pill-btn-sm"
      >
        {ui.switchTo}
      </button>

      <div className="tab-switch" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "invite"}
          data-active={tab === "invite"}
          onClick={() => setTab("invite")}
        >
          {ui.tabInvite}
        </button>
        <button
          role="tab"
          aria-selected={tab === "wall"}
          data-active={tab === "wall"}
          onClick={() => setTab("wall")}
        >
          {ui.tabWall}
        </button>
      </div>

      {tab === "invite" ? (
        <article
          className={
            "inv invite-card w-full " + (opened ? "da3wa-fade-in" : "invisible")
          }
        >
          {/* The order Eslam specified: the opening line, the date, the names
              in Latin, the two families, the names again, save the date, the
              time, then the venue. The English card keeps the same order. */}
          <Reveal className="inv-sec pad">
            <div className="ornament-divider" aria-hidden="true">
              <StarOrnamentIcon size={14} />
            </div>
            <p className="body" style={{ lineHeight: 2.2, marginTop: "1.5rem" }}>
              {splitLines(copy.opening, 3).map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>
          </Reveal>

          {event.eventDate && (
            /* dir=ltr, or the RTL paragraph reorders the groups and
               22.10.2026 is rendered as 2026.10.22. */
            <Reveal className="inv-sec" delay={60}>
              <p className="inv-date" dir="ltr">
                {event.eventDate.split("-").reverse().join(" . ")}
              </p>
            </Reveal>
          )}

          {latinNames && (
            /* Most of a screen to itself. This is the engraved centre of a
               printed invitation, and it is the only thing on the card that
               earns that much room. */
            <Reveal className="inv-sec" delay={60}>
              <div className="inv-names-latin inv-script" dir="ltr">
                {latinPair ? (
                  <>
                    <span className="n one">{latinPair[0]}</span>
                    <span className="inv-amp">&amp;</span>
                    <span className="n two">{latinPair[1]}</span>
                  </>
                ) : (
                  <span className="n">{latinNames}</span>
                )}
              </div>
            </Reveal>
          )}

          <div className="inv-rule" aria-hidden="true" />

          <Reveal className="inv-sec pad" delay={60}>
            <p className="body" style={{ lineHeight: 2.1 }}>
              {splitLines(copy.dedication, 3).map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>

            {families ? (
              /* One family either side of the join, each leaning into it.
                 Both centred would read as a list of two customers. */
              <p className="inv-families" style={{ marginTop: "1.7rem" }}>
                <span className="fam r">{families[0]}</span>
                <span className="waw">{english ? "&" : "و"}</span>
                <span className="fam l">{families[1]}</span>
              </p>
            ) : (
              <p
                className="font-display"
                style={{ fontSize: "var(--text-xl)", lineHeight: 1.9, color: "var(--ink)", marginTop: "1.7rem" }}
              >
                {familyLine || ui.familiesFallback}
              </p>
            )}

            {/* Plain text, not the calligraphic face: this is the sentence
                the card makes, and calligraphy on every line leaves nothing
                for the names to be. */}
            <p className="body" style={{ lineHeight: 2.1, marginTop: "1.5rem" }}>
              {copy.inviteLine}
            </p>

            <h1 className="inv-names-ar" style={{ marginTop: "1.5rem" }}>
              {namesPair ? (
                <>
                  <span className="n">{namesPair[0]}</span>
                  <span className="inv-amp inv-script">&amp;</span>
                  <span className="n">{namesPair[1]}</span>
                </>
              ) : (
                <span className="n">{namesWhole}</span>
              )}
            </h1>
          </Reveal>

          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            {/* Title case, not SAVE THE DATE. A connecting script has no
                capitals to connect — set in caps it stops being handwriting
                and becomes four unreadable shapes. */}
            <p className="inv-script inv-save" dir="ltr">
              {splitLines(copy.saveTheDate).map((line, i) => (
                <span key={i} className={i === 0 ? "l1" : "l2"}>
                  {line}
                </span>
              ))}
            </p>
          </Reveal>

          {latinTime && (
            <>
              <div className="inv-rule" aria-hidden="true" />
              <Reveal className="inv-sec pad" delay={60}>
                <p className="inv-eyebrow" dir="ltr" style={{ letterSpacing: "0.3em" }}>{copy.atLabel}</p>
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
                <p className="inv-eyebrow">{copy.venueLabel}</p>
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
                    {copy.mapCta}
                  </a>
                )}
              </Reveal>
            </>
          )}

          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            <p className="inv-eyebrow">{copy.timelineLabel}</p>
            <Timeline date={event.eventDate} steps={event.timeline} lang={language} />
          </Reveal>

          {/* Only while there is something to count down to — after the night
              it would sit at zero, which is a worse thing to show than
              nothing at all. */}
          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            <p className="inv-eyebrow">{copy.countdownLabel}</p>
            <Countdown
              date={event.eventDate}
              time={event.eventTime}
              units={ui.countdownUnits}
              ariaLabel={ui.countdownAria}
            />
          </Reveal>

          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            {guest.status === "pending" && (
              <p className="inv-eyebrow">{copy.rsvpLabel}</p>
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
                    <strong style={{ color: "var(--gold-600)" }}>
                      {ui.partyIntro(guest.maxCompanions + 1)}
                    </strong>{" "}
                    — {ui.partyYouAnd(guest.maxCompanions)}.
                    <br />
                    <span className="meta">{ui.partyQuestion}</span>
                  </p>

                  {/* Chips rather than a dropdown: at most a handful of
                      options, and a select hides them behind a tap. */}
                  <div className="seat-pick" role="radiogroup" aria-label={ui.partyAria}>
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
                    {companions === 0 ? ui.onlyYou : ui.partyYouAnd(companions)}
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
                  {submitting ? ui.confirming : ui.confirm}
                </button>
                <button
                  disabled={submitting}
                  onClick={() => respond(false)}
                  className="pill-btn-outline w-full"
                >
                  {ui.decline}
                </button>
              </div>
              {state.error && <p className="error">{state.error}</p>}
            </div>
          )}

          {guest.status === "confirmed" && (
            <div className="flex flex-col gap-4" aria-live="polite">
              <p
                className="chip chip-ok self-center"
                style={{ fontSize: "var(--text-sm)", padding: "0.4rem 0.9rem" }}
              >
                <CheckCircleIcon size={16} />
                {ui.confirmed(guest.confirmedCompanions || 0)}
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
                      alt={ui.qrAlt(guest.name)}
                      className="rounded-xl block"
                      width={280}
                      height={280}
                      style={{ width: "100%", maxWidth: 280, height: "auto" }}
                    />
                  </div>
                  <figcaption className="meta flex items-center gap-2">
                    <QrIcon size={15} />
                    {ui.qrCaption}
                  </figcaption>
                </figure>
              ) : (
                <p className="meta da3wa-pulse">{ui.qrPreparing}</p>
              )}
            </div>
          )}

          {guest.status === "declined" && (
            <p className="flex items-center justify-center gap-2 body" aria-live="polite">
              <span style={{ color: "var(--ink-3)" }}><XCircleIcon size={18} /></span>
              {ui.declined}
            </p>
          )}
          </Reveal>

          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={60}>
            <p
              className="font-display"
              style={{ color: "var(--gold-600)", fontSize: "var(--text-xl)", lineHeight: 1.9, marginBottom: "1.4rem" }}
            >
              {copy.wishesTitle}
            </p>

            <div className="flex flex-col gap-2" style={{ textAlign: "start" }}>
              <label htmlFor="wish" className="label flex items-center gap-2">
                <span style={{ color: "var(--gold-500)" }}><MessageIcon size={16} /></span>
                {guest.wishMessage ? ui.wishEdit : copy.wishesLabel}
              </label>
              <textarea
                id="wish"
                value={wishText}
                onChange={(e) => setWishText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={ui.wishPlaceholder}
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
                {wishSubmitting ? ui.wishSending : guest.wishMessage ? ui.wishUpdate : ui.wishSend}
              </button>
              {guest.wishMessage && (
                <p
                  className="flex items-center gap-2"
                  style={{ fontSize: "var(--text-xs)", color: "var(--ok)" }}
                  aria-live="polite"
                >
                  <CheckCircleIcon size={14} />
                  {ui.wishSent}
                </p>
              )}
            </div>
          </Reveal>

          {/* The invitation ends on the name of the person it was written
              for. */}
          <div className="inv-rule" aria-hidden="true" />
          <Reveal className="inv-sec pad" delay={80}>
            <p className="inv-eyebrow">{copy.guestLabel}</p>
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
            {ui.wallTitle}
          </h2>
          <p
            className="text-center mb-4"
            style={{ fontSize: "var(--text-xs)", color: "rgba(243,237,224,0.55)" }}
          >
            {ui.wallSubtitle}
          </p>

          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
            {wishesLoading && (
              <p className="text-center py-8 da3wa-pulse" style={{ color: "rgba(243,237,224,0.6)" }}>
                {ui.loading}
              </p>
            )}

            {!wishesLoading && wishes.length === 0 && (
              <div className="empty" style={{ color: "rgba(243,237,224,0.65)" }}>
                <span style={{ color: "var(--gold-400)" }}><InboxIcon size={30} /></span>
                <p style={{ fontSize: "var(--text-sm)" }}>{ui.wallEmpty}</p>
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
                  {/* Each message in its own direction: an English card's wall
                      still shows the Arabic wishes other guests left. */}
                  <p dir="auto" style={{ fontSize: "var(--text-sm)", lineHeight: 1.7, marginTop: "0.15rem" }}>
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
