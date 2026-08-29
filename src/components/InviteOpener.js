"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayIcon, SoundOnIcon, SoundOffIcon, ChevronDownIcon } from "@/components/icons";
import { EnvelopeMark } from "@/components/EnvelopeMark";

// The cover that opens a wedding invitation: the couple's own film, full
// screen, with their music, dismissed when the film ends.
//
// The tap is not a design flourish. Browsers refuse to start audio without a
// user gesture, and a muted invitation film is a silent one — so a gesture has
// to be asked for either way. Asking for it as "open your invitation" turns a
// platform restriction into the moment the invitation opens.
//
// Video and audio are separate elements on purpose: the film is usually cut
// silent, and couples pick their music separately from whoever made it. The
// video stays muted and `playsInline` (iOS otherwise takes it fullscreen and
// hands control to the system player), while the audio element carries sound.

export function InviteOpener({ videoUrl, posterUrl, audioUrl, coupleNames, guestName, copy = {}, onOpened }) {
  const [state, setState] = useState("idle"); // idle | opening | playing | closing | done
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Stable across renders (no deps), so it can be handed to the media event
  // handlers directly — an earlier version mirrored it into a ref, which
  // React forbids writing during render and which bought nothing.
  const finish = useCallback(() => {
    setState((s) => (s === "done" || s === "closing" ? s : "closing"));
  }, []);

  useEffect(() => {
    if (state !== "closing") return;
    const t = setTimeout(() => {
      setState("done");
      onOpened?.();
    }, 700); // matches the opener-out animation
    return () => clearTimeout(t);
  }, [state, onOpened]);

  // The envelope opens and grows into the film rather than cutting to it: the
  // invitation should look like it comes out of the envelope the guest just
  // opened, which is the only reason the envelope is there at all.
  //
  // The music still starts inside the click handler — that gesture is what
  // makes the browser allow audio, and it cannot be deferred to a timer. The
  // film can be: a muted video is allowed to start on its own.
  function open() {
    if (state !== "idle") return;
    setState("opening");
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.85;
      audio.play().catch(() => {});
    }
  }

  useEffect(() => {
    if (state !== "opening") return;
    const t = setTimeout(async () => {
      setState("playing");
      const video = videoRef.current;
      if (!video) return finish();
      // If the device refuses the film there is nothing to watch, so don't
      // hold the guest on a black screen.
      try {
        await video.play();
      } catch {
        finish();
      }
    }, 900); // matches the envelope opening
    return () => clearTimeout(t);
  }, [state, finish]);

  return (
    <>
      {/* Mounted for the whole life of the page, not just while the cover is
          up — unmounting it would stop the music the moment the invitation
          finished opening. */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" loop />}

      {state === "done" && <OpenedSoundControl audioRef={audioRef} audioUrl={audioUrl} />}

      <div
        className="opener"
        data-closing={state === "closing"}
        role="dialog"
        aria-label="افتح دعوتك"
        hidden={state === "done"}
      >
        {posterUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={posterUrl} alt="" className="opener-media" aria-hidden="true" />
        )}

        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl || undefined}
            className="opener-media"
            muted
            playsInline
            preload="auto"
            onEnded={() => finish()}
            onError={() => finish()}
          />
        )}

        {state === "idle" || state === "opening" ? (
          /* The envelope, then the film. Removing it was a mistake — the
             sealed envelope is the moment the invitation is handed over, and
             the film is what is inside it, not a replacement for it. */
          <button
            type="button"
            onClick={open}
            className="opener-tap"
            data-opening={state === "opening"}
          >
            <span className="opener-env">
              {/* Drawn in front of the guest, then opened — the ink has to dry
                  before the tap means anything. The seal is a heart here
                  rather than the house star: this surface belongs to the
                  couple, not to the product. */}
              <EnvelopeMark
                width={250}
                seal="heart"
                ink="#e0c48d"
                sealFill="#e0c48d"
                bodyFill="rgba(20,16,10,.55)"
                flapFill="rgba(28,23,16,.75)"
              />
            </span>

            {/* The guest's own name on the outside of the envelope, which is
                where a name goes. Every guest has their own link, so every
                guest sees theirs and only theirs. */}
            <span className="opener-label">
              <i aria-hidden="true" /> {copy.coverLabel || "دعوة خاصة لـ"} <i aria-hidden="true" />
            </span>
            {guestName && (
              <span
                className="font-display opener-title"
                style={{ fontSize: "var(--text-3xl)", color: "#fdf3dc", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}
              >
                {guestName}
              </span>
            )}
            <span className="opener-label quiet">{copy.coverFrom || "من"}</span>
            <span
              className="font-display opener-title"
              style={{ fontSize: "var(--text-2xl)", color: "#e6cd97", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}
            >
              {coupleNames}
            </span>

            <span className="opener-pill">
              <PlayIcon size={18} />
              {copy.openCta || "اضغط لفتح دعوتك"}
            </span>
          </button>
        ) : (
          <>
            <div className="opener-veil" aria-hidden="true" />
            <button type="button" onClick={() => finish()} className="opener-skip">
              تخطّي
              <ChevronDownIcon size={13} />
            </button>
          </>
        )}
      </div>
    </>
  );
}

// Once the invitation is open the music keeps playing, so it needs a way off.
// A guest opening this at work should be one tap from silence.
function OpenedSoundControl({ audioRef, audioUrl }) {
  const [muted, setMuted] = useState(false);
  if (!audioUrl) return null;

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="sound-toggle"
      aria-label={muted ? "تشغيل الموسيقى" : "كتم الموسيقى"}
    >
      {muted ? <SoundOffIcon size={20} /> : <SoundOnIcon size={20} />}
    </button>
  );
}
