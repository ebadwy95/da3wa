"use client";

// The mark, and the same mark animated.
//
// It is the eight-point star the invitation card, the film and the app icon
// are already built from — so the logo is the product's existing geometry
// rather than a new shape bolted on beside it. The outer star is drawn open
// and the inner one filled: an invitation is an outline you are invited to
// step inside.
//
// Two rings around it, broken at the compass points, are the border of a
// printed wedding card reduced to its essentials.

const OUTER = "M32 5 L37.8 26.2 L59 32 L37.8 37.8 L32 59 L26.2 37.8 L5 32 L26.2 26.2 Z";
const INNER = "M32 17.5 L35 29 L46.5 32 L35 35 L32 46.5 L29 35 L17.5 32 L29 29 Z";

/**
 * The static mark. `animated` runs the draw-on once when it mounts — used on
 * the landing hero; everywhere else it should sit still.
 */
export function LogoMark({ size = 40, animated = false, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="دعوة"
      className={`${animated ? "logo-animated " : ""}${className}`}
    >
      <circle className="logo-ring" cx="32" cy="32" r="29.5" stroke="currentColor"
              strokeWidth="1" opacity="0.28" strokeDasharray="6 10" />
      <circle className="logo-ring-2" cx="32" cy="32" r="24.5" stroke="currentColor"
              strokeWidth="0.8" opacity="0.18" />
      <path className="logo-outer" d={OUTER} stroke="currentColor" strokeWidth="2"
            strokeLinejoin="round" />
      <path className="logo-inner" d={INNER} fill="currentColor" />
    </svg>
  );
}

/**
 * Mark plus wordmark. `stacked` puts the word under the mark, for anywhere the
 * lockup needs to sit in a square.
 */
export function Logo({ size = 40, animated = false, stacked = false, showLatin = false }) {
  return (
    <span
      className={`inline-flex items-center gap-3${stacked ? " flex-col" : ""}${
        animated ? " logo-animated" : ""
      }`}
      style={{ color: "var(--gold-600)" }}
    >
      <LogoMark size={size} animated={animated} />
      <span className={`flex flex-col${stacked ? " items-center" : " items-start"}`}>
        <span
          className="logo-word font-display"
          style={{ fontSize: size * 0.62, lineHeight: 1.15 }}
        >
          دعوة
        </span>
        {showLatin && (
          <span
            className="logo-word"
            style={{
              fontSize: size * 0.24,
              letterSpacing: "0.34em",
              opacity: 0.65,
              marginTop: 2,
            }}
          >
            DA3WA
          </span>
        )}
      </span>
    </span>
  );
}
