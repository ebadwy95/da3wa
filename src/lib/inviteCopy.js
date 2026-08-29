// Every line of text on the invitation, in one place.
//
// The invitation Eslam approved is the template, not the product: another
// couple will want their own opening line, their own dedication, their own
// word before the guest's name. Those were spelled out inside the JSX, which
// made "change one word" a deploy.
//
// So each string is a field with a default. A couple who never opens the
// editor gets exactly the card that was designed; anything they do set
// replaces it, and clearing a field puts the default back rather than leaving
// a blank line on the card — an empty heading is a worse outcome than a
// heading they did not choose.
//
// This list is the single source: the invitation reads from it, the dashboard
// renders a field per entry, and the API validates against it. Adding a line
// to the card means adding one entry here and nothing else.

export const INVITE_COPY_FIELDS = [
  {
    key: "opening",
    label: "سطر البداية",
    hint: "أعلى الدعوة، فوق التاريخ. كل سطر في صف.",
    multiline: true,
    rows: 2,
    default: "بسم الله نبدأ فرحتنا\nوبالحب نكتب أجمل بدايات العمر",
  },
  {
    key: "dedication",
    label: "الإهداء",
    hint: "قبل أسماء العائلتين.",
    multiline: true,
    rows: 2,
    default: "إلى كل من نال في قلبنا مكان عزيز\nبكل حب وود تتشرف",
  },
  {
    key: "inviteLine",
    label: "سطر الدعوة",
    hint: "بعد أسماء العائلتين وقبل أسماء العروسين.",
    default: "بدعوتكم لحضور حفل زفاف نجليهما",
  },
  {
    key: "saveTheDate",
    label: "Save the Date",
    hint: "سطران، كل واحد في صف. يُكتبان بالخط المزخرف.",
    multiline: true,
    rows: 2,
    ltr: true,
    default: "Save the\nDate",
  },
  {
    key: "atLabel",
    label: "الكلمة فوق الوقت",
    ltr: true,
    default: "AT",
  },
  { key: "venueLabel", label: "عنوان قسم المكان", default: "المكان" },
  { key: "mapCta", label: "زر الخريطة", default: "اعرض الموقع على الخريطة" },
  { key: "timelineLabel", label: "عنوان البرنامج", default: "تفاصيل الليلة" },
  { key: "countdownLabel", label: "عنوان العدّاد", default: "باقي على الليلة" },
  { key: "rsvpLabel", label: "عنوان تأكيد الحضور", default: "حضورك يسعدنا" },
  {
    key: "wishesTitle",
    label: "عنوان رسائل التهنئة",
    default: "كلماتكم هدية تدوم مدى العمر",
  },
  {
    key: "wishesLabel",
    label: "فوق صندوق الرسالة",
    default: "اترك رسالة تهنئة للعروسين",
  },
  {
    key: "coverLabel",
    label: "على الظرف، قبل اسم الضيف",
    hint: "أول ما يفتح الضيف الرابط: «دعوة خاصة لـ … من …».",
    default: "دعوة خاصة لـ",
  },
  { key: "coverFrom", label: "على الظرف، قبل اسم العروسين", default: "من" },
  { key: "openCta", label: "زر فتح الدعوة", default: "اضغط لفتح دعوتك" },
  {
    key: "guestLabel",
    label: "في آخر الدعوة، قبل اسم الضيف",
    default: "دعوة خاصة بـ",
  },
];

// Longest a single field may be. Generous for a sentence, short enough that
// nobody can paste an essay onto a card that every guest has to scroll past.
export const INVITE_COPY_MAX = 240;

export function defaultInviteCopy() {
  return Object.fromEntries(INVITE_COPY_FIELDS.map((f) => [f.key, f.default]));
}

// What the invitation should render. An unset or blank field falls back to the
// default rather than rendering empty: a couple who clears a heading almost
// certainly wants the original back, and a card with a missing heading looks
// broken rather than customised.
export function resolveInviteCopy(raw) {
  const out = defaultInviteCopy();
  if (raw && typeof raw === "object") {
    for (const f of INVITE_COPY_FIELDS) {
      const v = raw[f.key];
      if (typeof v === "string" && v.trim()) out[f.key] = v.trim();
    }
  }
  return out;
}

// Sanitised on the way in and again on the way out of the guest endpoint.
// This text reaches every guest of the wedding, so it is never trusted: only
// known keys, only strings, and length-capped.
export function sanitiseInviteCopy(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const f of INVITE_COPY_FIELDS) {
    const v = raw[f.key];
    if (typeof v !== "string") continue;
    const trimmed = v.slice(0, INVITE_COPY_MAX).trim();
    // Only what differs from the default is stored, so a later change to the
    // designed wording reaches every couple who never overrode it.
    if (trimmed && trimmed !== f.default) out[f.key] = trimmed;
  }
  return out;
}

// "Save the\nDate" → ["Save the", "Date"]. Used for the two lines that are set
// as interlocking script; a single line is rendered on its own.
export function splitLines(value, max = 2) {
  return String(value || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}
