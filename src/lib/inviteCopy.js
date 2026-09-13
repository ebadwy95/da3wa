// Every line of text on the invitation, in one place — in Arabic and English.
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
// Every wedding also has an English card, for guests who don't read Arabic.
// It is the same card with the same sentences carried across — not a Western
// wedding invitation with the names swapped in. The opening still begins with
// the name of Allah, the families still do the inviting, and nothing appears
// that a Gulf wedding would not say. Each field has its own English default,
// and the English overrides are stored separately (event.inviteCopyEn), so a
// couple can reword one language without touching the other.
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
    defaultEn: "In the name of Allah we begin our joy,\nand with love we write life's most beautiful beginning",
  },
  {
    key: "dedication",
    label: "الإهداء",
    hint: "قبل أسماء العائلتين.",
    multiline: true,
    rows: 2,
    default: "إلى كل من نال في قلبنا مكان عزيز\nبكل حب وود تتشرف",
    defaultEn: "To everyone who holds a dear place in our hearts,\nwith love and warm regards",
  },
  {
    key: "inviteLine",
    label: "سطر الدعوة",
    hint: "بعد أسماء العائلتين وقبل أسماء العروسين.",
    default: "بدعوتكم لحضور حفل زفاف نجليهما",
    defaultEn: "request the honour of your presence at the wedding celebration of their children",
  },
  {
    key: "saveTheDate",
    label: "Save the Date",
    hint: "سطران، كل واحد في صف. يُكتبان بالخط المزخرف.",
    multiline: true,
    rows: 2,
    ltr: true,
    default: "Save the\nDate",
    defaultEn: "Save the\nDate",
  },
  {
    key: "atLabel",
    label: "الكلمة فوق الوقت",
    ltr: true,
    default: "AT",
    defaultEn: "AT",
  },
  { key: "venueLabel", label: "عنوان قسم المكان", default: "المكان", defaultEn: "The Venue" },
  { key: "mapCta", label: "زر الخريطة", default: "اعرض الموقع على الخريطة", defaultEn: "View the location on the map" },
  { key: "timelineLabel", label: "عنوان البرنامج", default: "تفاصيل الليلة", defaultEn: "The Evening's Programme" },
  { key: "countdownLabel", label: "عنوان العدّاد", default: "باقي على الليلة", defaultEn: "Counting down to the night" },
  { key: "rsvpLabel", label: "عنوان تأكيد الحضور", default: "حضورك يسعدنا", defaultEn: "Your presence would bring us joy" },
  {
    key: "wishesTitle",
    label: "عنوان رسائل التهنئة",
    default: "كلماتكم هدية تدوم مدى العمر",
    defaultEn: "Your kind words are a gift that lasts a lifetime",
  },
  {
    key: "wishesLabel",
    label: "فوق صندوق الرسالة",
    default: "اترك رسالة تهنئة للعروسين",
    defaultEn: "Leave a message of congratulations for the couple",
  },
  {
    key: "coverLabel",
    label: "على الظرف، قبل اسم الضيف",
    hint: "أول ما يفتح الضيف الرابط: «دعوة خاصة لـ … من …».",
    default: "دعوة خاصة لـ",
    defaultEn: "A special invitation for",
  },
  { key: "coverFrom", label: "على الظرف، قبل اسم العروسين", default: "من", defaultEn: "from" },
  { key: "openCta", label: "زر فتح الدعوة", default: "اضغط لفتح دعوتك", defaultEn: "Tap to open your invitation" },
  {
    key: "guestLabel",
    label: "في آخر الدعوة، قبل اسم الضيف",
    default: "دعوة خاصة بـ",
    defaultEn: "This invitation is especially for",
  },
];

export const INVITE_LANGUAGES = ["ar", "en"];

// "ar" or "en" from whatever a person typed — a sheet column, a query string,
// a dropdown. Null when it can't be read as either, so the caller decides
// whether that is an error (a sheet cell) or a fallback (a missing query).
const LANGUAGE_WORDS = {
  ar: ["ar", "ara", "arabic", "عربي", "عربى", "العربية", "العربيه", "ع"],
  en: ["en", "eng", "english", "انجليزي", "إنجليزي", "انجليزى", "إنجليزى", "الانجليزية", "الإنجليزية", "انكليزي", "e"],
};

export function normaliseInviteLanguage(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  for (const [lang, words] of Object.entries(LANGUAGE_WORDS)) {
    if (words.includes(v)) return lang;
  }
  return null;
}

function defaultFor(field, lang) {
  return lang === "en" ? field.defaultEn ?? field.default : field.default;
}

// Longest a single field may be. Generous for a sentence, short enough that
// nobody can paste an essay onto a card that every guest has to scroll past.
export const INVITE_COPY_MAX = 240;

export function defaultInviteCopy(lang = "ar") {
  return Object.fromEntries(INVITE_COPY_FIELDS.map((f) => [f.key, defaultFor(f, lang)]));
}

// What the invitation should render. An unset or blank field falls back to the
// default rather than rendering empty: a couple who clears a heading almost
// certainly wants the original back, and a card with a missing heading looks
// broken rather than customised.
export function resolveInviteCopy(raw, lang = "ar") {
  const out = defaultInviteCopy(lang);
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
export function sanitiseInviteCopy(raw, lang = "ar") {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const f of INVITE_COPY_FIELDS) {
    const v = raw[f.key];
    if (typeof v !== "string") continue;
    const trimmed = v.slice(0, INVITE_COPY_MAX).trim();
    // Only what differs from the default is stored, so a later change to the
    // designed wording reaches every couple who never overrode it.
    if (trimmed && trimmed !== defaultFor(f, lang)) out[f.key] = trimmed;
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
