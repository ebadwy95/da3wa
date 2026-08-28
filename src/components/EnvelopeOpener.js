"use client";

import { useCallback, useMemo, useRef, useState } from "react";

// The envelope an invitation — and the partner page — opens with.
//
// Same reasoning as InviteOpener: the tap is not decoration. Browsers refuse
// to start audio without a gesture, so opening the envelope and unlocking the
// sound are deliberately the same click.
//
// The flap hinges with scaleY(-1) rather than a 3D rotateX. An SVG child takes
// no perspective from its parent, so rotateX renders as no movement at all —
// which is exactly what the first version did. The seal fades as the flap
// lifts, since that is what was holding it shut, and the envelope grows to
// 2.2x: filling the screen reads as a splash screen rather than as something
// handed across to you.

// A fixed, seeded field rather than Math.random(): the server and the client
// must agree on every position or React throws a hydration mismatch, and a
// mote that jumps on first paint is worse than no mote at all.
function motes(count) {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: count }, () => ({
    left: `${(rand() * 100).toFixed(2)}%`,
    top: `${(rand() * 100).toFixed(2)}%`,
    size: `${(2 + rand() * 4).toFixed(1)}px`,
    delay: `${(rand() * 9).toFixed(2)}s`,
    duration: `${(9 + rand() * 9).toFixed(2)}s`,
    opacity: (0.16 + rand() * 0.42).toFixed(2),
  }));
}

export function EnvelopeOpener({
  audioUrl,
  title,
  eyebrow,
  cta = "افتح دعوتك",
  hint = "اضغط للفتح",
  // Used when the opener sits beside the content rather than wrapping it —
  // the invitation stages its own reveal and only needs to be told when.
  onOpened,
  children,
}) {
  const [opening, setOpening] = useState(false);
  const [gone, setGone] = useState(false);
  const audioRef = useRef(null);
  const openedRef = useRef(false);
  const dust = useMemo(() => motes(28), []);

  const open = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpening(true);

    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.32;
      // A rejected promise here only means no sound; the invitation still opens.
      audio.play().catch(() => {});
    }

    // Fired as the envelope starts to dissolve, not after it is gone, so the
    // invitation rises into the space it leaves instead of appearing after it.
    setTimeout(() => onOpened?.(), 820);

    // Unmounted rather than left transparent on top, where it would swallow
    // every tap on the invitation underneath.
    setTimeout(() => setGone(true), 1900);
  }, [onOpened]);

  return (
    <>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="none" loop />}

      <div className={`env-doc${opening ? " shown" : ""}`} aria-hidden={!opening}>
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
          <div className="env-dust" aria-hidden="true">
            {dust.map((m, i) => (
              <span
                key={i}
                style={{
                  left: m.left,
                  top: m.top,
                  width: m.size,
                  height: m.size,
                  opacity: m.opacity,
                  animationDelay: m.delay,
                  animationDuration: m.duration,
                }}
              />
            ))}
          </div>

          {eyebrow && <div className="env-eyebrow">{eyebrow}</div>}

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

          {/* The names, with a slow pass of light through the letters — the one
              flourish that is actually about the couple. */}
          {title && (
            <div className="env-title font-display">{title}</div>
          )}

          <div className="env-cta">{cta}</div>
          <div className="env-hint">{hint}</div>
        </div>
      )}
    </>
  );
}
