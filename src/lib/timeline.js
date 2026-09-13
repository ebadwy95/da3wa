// The order of the night as data — shared by the invitation, the dashboard
// editor and the guest endpoint, which is why it is not in the client-only
// Timeline component.

// What a wedding runs like when nobody has said otherwise. Every couple can
// replace it from the dashboard; most will not, and a sensible default beats
// an empty section.
//
// Each step carries its English wording too. "Zaffa" stays Zaffa: it is the
// name of the procession, and translating it into "wedding march" would
// describe a different thing.
export const DEFAULT_TIMELINE = [
  // Doors 45 minutes before anything happens. A guest who reads the programme
  // and turns up for the first line on it arrives as the groom does — the
  // reception is the line that actually tells them when to be there.
  { at: "19:45", label: "استقبال المعازيم", labelEn: "Welcoming the guests", icon: "guests" },
  { at: "20:30", label: "دخلة العريس", labelEn: "The groom's entrance", icon: "groom" },
  { at: "20:40", label: "دخلة العروس", labelEn: "The bride's entrance", icon: "bride" },
  { at: "22:00", label: "العشاء", labelEn: "Dinner", icon: "dinner" },
  { at: "22:30", label: "الزفة", labelEn: "The Zaffa", icon: "zaffa" },
  { at: "23:40", label: "التصوير", labelEn: "Photographs", icon: "camera" },
  { at: "00:00", label: "ختام الحفل", labelEn: "Farewell", icon: "fireworks" },
];

/**
 * A step's label in the invitation's language. In English: the couple's own
 * English label if they wrote one; otherwise the designed English wording when
 * the Arabic label is still one of the defaults; otherwise the Arabic label,
 * since showing what they wrote beats showing nothing.
 */
export function timelineLabel(step, lang) {
  const label = String(step?.label || "").trim();
  if (lang !== "en") return label;
  const own = String(step?.labelEn || "").trim();
  if (own) return own;
  return DEFAULT_TIMELINE.find((d) => d.label === label)?.labelEn || label;
}

/** The English placeholder the editor shows for a row. */
export function suggestedEnglishLabel(step) {
  const label = String(step?.label || "").trim();
  return (
    DEFAULT_TIMELINE.find((d) => d.label === label)?.labelEn ||
    DEFAULT_TIMELINE.find((d) => d.icon === step?.icon)?.labelEn ||
    ""
  );
}
