// The kinds of occasion the platform takes.
//
// The product was built around weddings and its wording still leans that way,
// but nothing in the mechanism is wedding-specific: a personal link, an RSVP
// with a headcount, and a code scanned at a door serve a graduation or a
// company opening identically. This list is what the enquiry form offers and
// what the admin sees on an enquiry.
export const EVENT_TYPES = [
  { id: "wedding", ar: "زفاف", en: "Wedding" },
  { id: "engagement", ar: "خطوبة", en: "Engagement" },
  { id: "milka", ar: "ملكة", en: "Milka" },
  { id: "birthday", ar: "عيد ميلاد", en: "Birthday" },
  { id: "newborn", ar: "استقبال مولود", en: "Newborn celebration" },
  { id: "graduation", ar: "تخرّج", en: "Graduation" },
  { id: "opening", ar: "افتتاح", en: "Opening" },
  { id: "corporate", ar: "مناسبة أو مؤتمر لشركة", en: "Corporate event" },
  { id: "other", ar: "مناسبة أخرى", en: "Something else" },
];

export function eventTypeLabel(id, locale = "ar") {
  const found = EVENT_TYPES.find((t) => t.id === id);
  if (!found) return id || "";
  return locale === "en" ? found.en : found.ar;
}
