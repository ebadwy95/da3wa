// The couple's names, in the two shapes the app needs them.
//
// Guests should always READ one natural phrase — "عبدالله و نور" — on the
// invitation and in every WhatsApp message. But the Meta-approved templates
// (da3wa_invite_link, da3wa_qr_delivery, da3wa_event_reminder) take {{groom}}
// and {{bride}} as separate variables and join them in the template body. So
// the event record stores the two names separately and the display string is
// derived from them, rather than the other way round — one source of truth,
// and no guessing at send time.
//
// Events created before this split only have the joined coupleNames. Those
// get split here on a best effort basis and the result is shown back in the
// admin edit form, so a wrong guess is visible and correctable BEFORE anyone
// presses send. Nothing is sent from a guessed value silently.

// The Arabic conjunction as it appears between two names: a lone و with
// space on both sides. Names that merely contain a waw ("عبدالوهاب",
// "نوران") are untouched because their waw isn't a separate word. Also
// accepts the Latin ampersand, which people type sometimes.
const CONJUNCTION_RE = /\s+(?:و|&)\s+/;

/**
 * Best-effort split of a joined display name into its two halves.
 * Returns empty strings when it can't tell — never a guess dressed up as a
 * result. Callers show whatever comes back in an editable field.
 */
export function splitCoupleNames(coupleNames) {
  const clean = String(coupleNames || "").trim();
  if (!clean) return { groomName: "", brideName: "" };

  const parts = clean.split(CONJUNCTION_RE);
  // More than two parts means something we don't understand (three names, a
  // waw inside a kunya). Leave it for a human rather than picking two.
  if (parts.length !== 2) return { groomName: "", brideName: "" };

  const [groomName, brideName] = parts.map((p) => p.trim());
  if (!groomName || !brideName) return { groomName: "", brideName: "" };
  return { groomName, brideName };
}

/**
 * The phrase guests read. Kept identical to what the templates produce when
 * they join {{groom}} and {{bride}}, so the invitation page and the WhatsApp
 * message never disagree.
 */
export function joinCoupleNames(groomName, brideName) {
  const g = String(groomName || "").trim();
  const b = String(brideName || "").trim();
  if (g && b) return `${g} و ${b}`;
  return g || b || "";
}

/**
 * The one place anything should read the couple's names from.
 * Prefers the stored split names, falls back to the legacy joined field, and
 * always returns all three shapes so callers never have to branch.
 */
export function resolveCoupleParts(event) {
  if (!event) return { groomName: "", brideName: "", coupleNames: "" };

  const stored = {
    groomName: String(event.groomName || "").trim(),
    brideName: String(event.brideName || "").trim(),
  };

  if (stored.groomName || stored.brideName) {
    return {
      ...stored,
      coupleNames: event.coupleNames || joinCoupleNames(stored.groomName, stored.brideName),
    };
  }

  const derived = splitCoupleNames(event.coupleNames);
  return { ...derived, coupleNames: String(event.coupleNames || "").trim() };
}
