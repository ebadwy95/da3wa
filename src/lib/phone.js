// Phone parsing for a Gulf/Levant wedding-guest audience where the same
// event can have guests from several countries (KW/SA/JO/AE/QA/BH/OM/EG...).
// Rule enforced everywhere: the input MUST include an explicit country
// code (+965..., 00965..., or 965... already prefixed) — we never guess a
// bare local number's country, since guest lists are known to be mixed.

// Known country calling codes we expect to see for this audience, longest
// first so e.g. "965" isn't swallowed by a shorter, wrong prefix.
const KNOWN_COUNTRY_CODES = [
  "971", // UAE
  "966", // Saudi Arabia
  "965", // Kuwait
  "974", // Qatar
  "973", // Bahrain
  "968", // Oman
  "962", // Jordan
  "20", // Egypt
  "1", // US/Canada (free Meta test numbers, etc.)
  "44", // UK
];

/**
 * Normalizes a raw phone string into Wati's expected format (digits only,
 * country code prefix, no leading +/00) and an E.164-style display form.
 * Returns { valid: true, digits, e164 } or { valid: false, error }.
 */
export function normalizePhone(raw) {
  if (!raw) return { valid: false, error: "الرقم فارغ" };

  let s = String(raw).trim();
  // Normalize "00" international prefix to "+".
  s = s.replace(/^00/, "+");

  // Strip everything except leading + and digits.
  const hasPlus = s.startsWith("+");
  const digitsOnly = s.replace(/[^\d]/g, "");

  if (!hasPlus) {
    return {
      valid: false,
      error: "يجب أن يبدأ الرقم برمز الدولة (+965 أو 00965 مثلًا) — الرقم بدون رمز دولة مرفوض",
    };
  }

  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return { valid: false, error: "طول الرقم غير منطقي" };
  }

  const matchedCode = KNOWN_COUNTRY_CODES.find((code) => digitsOnly.startsWith(code));
  if (!matchedCode) {
    return {
      valid: false,
      error: "رمز الدولة ليس من الدول المدعومة حاليًا — يُرجى التواصل مع الدعم إن كان الرقم صحيحًا",
    };
  }

  return {
    valid: true,
    digits: digitsOnly, // what Wati's API expects
    e164: `+${digitsOnly}`,
    countryCode: matchedCode,
  };
}
