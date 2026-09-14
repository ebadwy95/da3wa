// Phone parsing for a Gulf/Levant wedding-guest audience where the same
// event can have guests from several countries (KW/SA/JO/AE/QA/BH/OM/EG...).
// Rule enforced everywhere: the number MUST carry its country code — we never
// guess a bare local number's country, since guest lists are known to be
// mixed.
//
// The code can be written +965…, 00965… or just 965…. The last form is what a
// spreadsheet leaves: Excel reads a leading + as the start of a formula and
// drops it, so a sheet typed with +965 arrives as 965. Without a + there is no
// way to tell "965 51234567" from a local number that happens to start with
// 965, so a number without one is only accepted at the exact length its
// country's numbers have. An eight-digit Kuwaiti local number like 96551234
// is still refused, rather than read as a Kuwaiti code with half a number.

// Known country calling codes we expect to see for this audience, with the
// number of digits after the code. Checked longest code first so "965" isn't
// swallowed by a shorter, wrong prefix.
const COUNTRIES = [
  { code: "971", national: [9] }, // UAE (mobiles are 9 digits after 971)
  { code: "966", national: [9] }, // Saudi Arabia
  { code: "965", national: [8] }, // Kuwait
  { code: "974", national: [8] }, // Qatar
  { code: "973", national: [8] }, // Bahrain
  { code: "968", national: [8] }, // Oman
  { code: "962", national: [9] }, // Jordan
  { code: "20", national: [10] }, // Egypt
  { code: "44", national: [10] }, // UK
  { code: "1", national: [10] }, // US/Canada (free Meta test numbers, etc.)
];

const EXAMPLE = "مثلًا 96550012345 للكويت أو 966512345678 للسعودية";

/**
 * Normalizes a raw phone string into the format the WhatsApp providers expect
 * (digits only, country code prefix, no leading +/00) and an E.164-style
 * display form. Returns { valid: true, digits, e164, countryCode } or
 * { valid: false, error }.
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { valid: false, error: "الرقم فارغ" };
  }

  // A spreadsheet cell can hold the number as a number.
  let s = typeof raw === "number" ? raw.toFixed(0) : String(raw).trim();

  // Excel shows a long number as 9.66551E+11, and a sheet saved from that
  // view keeps only those digits. The rest of the number is gone, so say what
  // happened instead of calling it the wrong length.
  if (/^\d+([.,]\d+)?e\+?\d+$/i.test(s)) {
    return {
      valid: false,
      error: "الرقم اتحفظ في Excel بالشكل 9.66E+11 وضاعت منه أرقام — خلّي عمود الرقم «نص» (Text) واكتبه تاني",
    };
  }

  // Normalize "00" international prefix to "+".
  s = s.replace(/^00/, "+");
  const hasPlus = s.startsWith("+");
  const digitsOnly = s.replace(/[^\d]/g, "");

  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return { valid: false, error: `طول الرقم غير منطقي — اكتبه بكود الدولة، ${EXAMPLE}` };
  }

  const country = COUNTRIES.find((c) => digitsOnly.startsWith(c.code));
  if (!country) {
    return {
      valid: false,
      error: hasPlus
        ? "رمز الدولة ليس من الدول المدعومة حاليًا — يُرجى التواصل مع الدعم إن كان الرقم صحيحًا"
        : `يجب أن يبدأ الرقم بكود الدولة، ${EXAMPLE} — الرقم المحلي بدون كود دولة مرفوض`,
    };
  }

  if (!hasPlus && !country.national.includes(digitsOnly.length - country.code.length)) {
    return {
      valid: false,
      error: `الرقم لازم يبدأ بكود الدولة وبعده الرقم كامل، ${EXAMPLE}`,
    };
  }

  return {
    valid: true,
    digits: digitsOnly,
    e164: `+${digitsOnly}`,
    countryCode: country.code,
  };
}
