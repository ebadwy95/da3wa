// The envelope both openers show, drawn on rather than placed.
//
// Eslam asked for the drawing to happen in front of the guest and only then
// for it to open. That ordering is the whole point: an envelope that is simply
// there is a picture of an envelope, while one that is being drawn is a thing
// being prepared for you. The tap that opens it lands after the ink has dried,
// so the two motions never fight.
//
// Every stroke carries pathLength="100", so the dash animation is written in
// percentages and none of it depends on measuring the geometry at runtime —
// which is what a getTotalLength() version would need, and would get wrong on
// the server.
//
// The flap is a curve, not a triangle. A folded paper flap is die-cut with a
// slight bow; the straight-edged version read as a paper aeroplane.

const BODY = "M8 38h270a14 14 0 0 1 14 14v136a14 14 0 0 1-14 14H22a14 14 0 0 1-14-14V52a14 14 0 0 1 14-14Z";
const INNER = "M17 47h266a7 7 0 0 1 7 7v128a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7V54a7 7 0 0 1 7-7Z";
const CREASES = "M10 195 118 126M290 195 182 126";
const FLAP = "M8 52Q150 36 292 52Q226 100 150 137Q74 100 8 52Z";
const FLAP_RULE = "M22 56Q150 42 278 56";

// A four-point sparkle, small, at each corner of the body — the detail that
// makes it stationery rather than a mail icon.
const CORNERS = [
  [36, 92],
  [264, 92],
  [36, 172],
  [264, 172],
];
const sparkle = (x, y, r = 7) =>
  `M${x} ${y - r}Q${x + r * 0.26} ${y - r * 0.26} ${x + r} ${y}` +
  `Q${x + r * 0.26} ${y + r * 0.26} ${x} ${y + r}` +
  `Q${x - r * 0.26} ${y + r * 0.26} ${x - r} ${y}` +
  `Q${x - r * 0.26} ${y - r * 0.26} ${x} ${y - r}Z`;

const HEART =
  "M32 55c-16-12.6-27-22-27-33.2A13.6 13.6 0 0 1 32 16.2 13.6 13.6 0 0 1 59 21.8C59 33 48 42.4 32 55Z";
const STAR = "M32 5 37.8 26.2 59 32 37.8 37.8 32 59 26.2 37.8 5 32 26.2 26.2Z";

export function EnvelopeMark({
  width = 300,
  ink = "#b08d57",
  seal = "star",
  bodyFill = "#14100a",
  flapFill = "#1c1710",
  sealFill = "#d9b877",
  className = "",
}) {
  const height = Math.round((width * 210) / 300);
  // Inline custom properties rather than a class per step: the stagger is data
  // about this drawing, and spelling it out here keeps the CSS to one rule.
  const at = (d) => ({ "--d": `${d}s` });

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 300 210"
      fill="none"
      className={`env-mark-svg ${className}`}
      style={{ overflow: "visible" }}
      aria-hidden="true"
      focusable="false"
    >
      <path className="env-fill" style={at(0.55)} d={BODY} fill={bodyFill} />
      <path className="env-ink" style={at(0)} d={BODY} pathLength="100" stroke={ink} strokeWidth="1.6" />
      <path className="env-ink" style={at(0.4)} d={INNER} pathLength="100" stroke={ink} strokeWidth="0.9" opacity=".38" />
      <path className="env-ink" style={at(0.55)} d={CREASES} pathLength="100" stroke={ink} strokeWidth="1" opacity=".28" />

      {CORNERS.map(([x, y], i) => (
        <path key={i} className="env-pop" style={at(1.35 + i * 0.08)} d={sparkle(x, y)} fill={ink} opacity=".45" />
      ))}

      {/* Grouped so the openers can hinge the whole flap; see .env-flap. */}
      <g className="env-flap">
        <path className="env-fill" style={at(1.25)} d={FLAP} fill={flapFill} />
        <path
          className="env-ink"
          style={at(0.8)}
          d={FLAP}
          pathLength="100"
          stroke={ink}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path className="env-ink" style={at(1.25)} d={FLAP_RULE} pathLength="100" stroke={ink} strokeWidth="0.9" opacity=".42" />
      </g>

      {/* The seal sits where the flap closes, which is where a wax seal goes.
          A heart on a wedding invitation, the house star everywhere else —
          this same mark opens the partner page, and a heart is wrong there. */}
      <g className="env-seal" transform="translate(150 124) scale(0.78) translate(-32 -32)">
        <g className="env-pop" style={at(1.7)}>
        <circle cx="32" cy="32" r="29.5" stroke={sealFill} strokeWidth="1" opacity=".3" strokeDasharray="6 10" />
        {seal === "heart" ? (
          <path d={HEART} fill={sealFill} fillOpacity=".92" />
        ) : (
          <>
            <path d={STAR} stroke={sealFill} strokeWidth="2" strokeLinejoin="round" fill={bodyFill} />
            <path d="M32 17.5 35 29 46.5 32 35 35 32 46.5 29 35 17.5 32 29 29Z" fill={sealFill} />
          </>
        )}
        </g>
      </g>
    </svg>
  );
}
