// What the guest looks at for the second between tapping the link and the
// invitation arriving.
//
// It used to say "جارٍ فتح الدعوة…" under a pulsing star. Eslam asked for the
// mark to be drawn instead, and he is right: the first frame of a wedding
// invitation should not be a progress message. The star writes itself, fills,
// and starts again — the same eight-point mark that seals the envelope and
// slides down the programme, so the wait is already part of the invitation.
//
// pathLength="100" lets the dash animation be written in percentages instead
// of measuring the path in JavaScript, which would mean a client effect and a
// first paint with the star already whole.

export function BrandLoader({ size = 96, label = "جارٍ فتح الدعوة" }) {
  return (
    <div className="brand-loader" role="status" aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path
          className="bl-star"
          pathLength="100"
          d="M50 5 60 40 95 50 60 60 50 95 40 60 5 50 40 40Z"
        />
      </svg>
    </div>
  );
}
