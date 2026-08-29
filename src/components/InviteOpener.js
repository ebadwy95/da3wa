"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayIcon, SoundOnIcon, SoundOffIcon, ChevronDownIcon } from "@/components/icons";

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

export function InviteOpener({ videoUrl, posterUrl, audioUrl, coupleNames, onOpened }) {
  const [state, setState] = useState("idle"); // idle | playing | closing | done
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

  async function open() {
    setState("playing");
    const video = videoRef.current;
    const audio = audioRef.current;

    // Both are started from inside the click handler, which is what makes the
    // browser allow the audio at all.
    const tries = [];
    if (video) tries.push(video.play());
    if (audio) {
      audio.volume = 0.85;
      tries.push(audio.play());
    }
    const results = await Promise.allSettled(tries);

    // If there's no film — music only, or a device that refused the video —
    // there's nothing to watch, so don't hold the guest on a black screen.
    const videoPlaying = video && results[0]?.status === "fulfilled";
    if (!videoPlaying) finish();
  }

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

        {state === "idle" ? (
          /* The envelope, then the film. Removing it was a mistake — the
             sealed envelope is the moment the invitation is handed over, and
             the film is what is inside it, not a replacement for it. */
          <button type="button" onClick={open} className="opener-tap">
            <span className="opener-env" aria-hidden="true">
              <svg width="240" height="168" viewBox="0 0 300 210" fill="none" style={{ overflow: "visible" }}>
                <rect x="6" y="34" width="288" height="170" rx="12" fill="rgba(20,16,10,.55)" stroke="#e0c48d" strokeWidth="1.6" />
                <path d="M6 46 L150 132 L294 46" stroke="#e0c48d" strokeWidth="1.2" opacity=".5" fill="none" />
                <path d="M6 196 L112 122 M294 196 L188 122" stroke="#e0c48d" strokeWidth="1" opacity=".3" />
                <path d="M6 46 L150 6 L294 46 L150 128 Z" fill="rgba(28,23,16,.75)" stroke="#e0c48d" strokeWidth="1.6" strokeLinejoin="round" />
                {/* The seal is a heart here rather than the star: this is the
                    one surface that belongs to the couple, not the product. */}
                <path
                  d="M150 132c-14-11-26-19.6-26-30.4a13 13 0 0 1 26-5.2 13 13 0 0 1 26 5.2c0 10.8-12 19.4-26 30.4Z"
                  fill="#e0c48d"
                  fillOpacity=".92"
                />
              </svg>
            </span>

            <span style={{ fontSize: "var(--text-sm)", color: "rgba(240,220,174,.75)" }}>
              لديك دعوة من
            </span>
            <span
              className="font-display opener-title"
              style={{ fontSize: "var(--text-3xl)", color: "#f0dcae", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}
            >
              {coupleNames}
            </span>

            <span className="opener-pill">
              <PlayIcon size={18} />
              اضغط لفتح دعوتك
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
