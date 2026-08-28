"use client";

import { useCallback, useRef, useState } from "react";

// The envelope the partner page opens with.
//
// Same reasoning as InviteOpener: the tap is not decoration. Browsers refuse
// to start audio without a gesture, so opening the envelope and unlocking the
// sound are deliberately the same click.
//
// The flap hinges with scaleY(-1) rather than a 3D rotateX — SVG children
// take no perspective from their parent, so rotateX renders as no movement at
// all. The seal fades as the flap lifts, since that is what was holding it
// shut, and the envelope grows to 2.2x: filling the screen reads as a splash
// screen rather than something handed across to you.
export function EnvelopeOpener({ audioUrl, cta = "استقبل الدعوة", children }) {
  const [opening, setOpening] = useState(false);
  const [gone, setGone] = useState(false);
  const audioRef = useRef(null);
  const openedRef = useRef(false);

  const open = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpening(true);

    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.32;
      // A rejected promise here just means no sound; the page still opens.
      audio.play().catch(() => {});
    }

    // The overlay is unmounted rather than left transparent on top, which
    // would swallow every click on the document underneath.
    setTimeout(() => setGone(true), 1900);
  }, []);

  return (
    <>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="none" loop />}

      <div
        className={`env-doc${opening ? " shown" : ""}`}
        // Hidden from assistive tech until it is actually readable.
        aria-hidden={!opening}
      >
        {children}
      </div>

      {!gone && (
        <div
          className={`env-open${opening ? " opening" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={cta}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          }}
        >
          <div className="env-mark">
            <svg width="300" height="210" viewBox="0 0 300 210" fill="none" style={{ overflow: "visible" }}>
              <rect x="6" y="34" width="288" height="170" rx="12" fill="#14100a" stroke="#b08d57" strokeWidth="1.6" />
              <path d="M6 46 L150 132 L294 46" stroke="#b08d57" strokeWidth="1.2" opacity=".45" fill="none" />
              <path d="M6 196 L112 122 M294 196 L188 122" stroke="#b08d57" strokeWidth="1" opacity=".28" />
              <g className="env-flap">
                <path d="M6 46 L150 6 L294 46 L150 128 Z" fill="#1c1710" stroke="#b08d57" strokeWidth="1.6" strokeLinejoin="round" />
              </g>
              <g className="env-seal" transform="translate(150 118) scale(0.72) translate(-32 -32)">
                <circle cx="32" cy="32" r="29.5" stroke="#d9b877" strokeWidth="1" opacity=".3" strokeDasharray="6 10" />
                <path
                  d="M32 5 L37.8 26.2 L59 32 L37.8 37.8 L32 59 L26.2 37.8 L5 32 L26.2 26.2 Z"
                  stroke="#d9b877"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  fill="#14100a"
                />
                <path d="M32 17.5 L35 29 L46.5 32 L35 35 L32 46.5 L29 35 L17.5 32 L29 29 Z" fill="#d9b877" />
              </g>
            </svg>
          </div>

          <div className="env-cta font-display">{cta}</div>
          <div className="env-hint">اضغط للفتح</div>
        </div>
      )}
    </>
  );
}
