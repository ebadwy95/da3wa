// The invitation's fixed wording — buttons, confirmations, the wall of wishes —
// in both languages.
//
// These are not in inviteCopy.js because nobody should reword them: they are
// the product talking ("Confirm attendance", "Preparing your entry code"), not
// the couple. They still need an English form, or an English card would ask a
// guest who can't read Arabic to press a button they can't read.

function companionsAr(n) {
  // Arabic counts don't take a plural noun the way English does — "1 مرافقين"
  // reads as broken to a native speaker. Singular, dual and plural each need
  // their own form.
  if (n === 1) return "مرافق واحد";
  if (n === 2) return "مرافقَين";
  if (n <= 10) return `${n} مرافقين`;
  return `${n} مرافقًا`;
}

function companionsEn(n) {
  return n === 1 ? "one companion" : `${n} companions`;
}

const AR = {
  dir: "rtl",
  switchTo: "English",
  switchToLang: "en",
  tabInvite: "الدعوة",
  tabWall: "رسائل التهنئة",
  familiesFallback: "",
  partyIntro: (total) => `دعوتك تشمل ${total} أفراد`,
  partyYouAnd: (n) => `أنت و${companionsAr(n)}`,
  partyQuestion: "كم فردًا سيحضر؟",
  partyAria: "عدد الحاضرين",
  onlyYou: "أنت فقط",
  confirm: "أكّد الحضور",
  confirming: "جارٍ التأكيد...",
  decline: "أعتذر عن الحضور",
  confirmed: (n) => `تم تأكيد حضورك${n ? ` مع ${n} من المرافقين` : ""}`,
  // The entry pass is not shown on the page any more — it arrives on WhatsApp
  // as a designed card, from the number the invitation came from.
  qrOnWhatsAppTitle: "بطاقة الدخول في طريقها إليك",
  qrOnWhatsApp: "ستصلك بطاقة الدخول (QR) الآن على واتساب من فريق دعوة — احتفظ بها لتُبرزها عند باب القاعة.",
  declined: "تم تسجيل اعتذارك، نتمنى أن نراك في مناسبة أخرى",
  wishEdit: "تعديل رسالتك للعروسين",
  wishPlaceholder: "اكتب هنا رسالتك أو تهنئتك...",
  wishSending: "جارٍ الإرسال...",
  wishUpdate: "تحديث الرسالة",
  wishSend: "إرسال الرسالة",
  wishSent: "تم إرسال رسالتك، ويمكنك تعديلها في أي وقت.",
  wallTitle: "رسائل التهنئة",
  wallSubtitle: "من كل من شارك العروسين فرحتهم",
  loading: "جارٍ التحميل...",
  wallEmpty: "لم تصل رسائل تهنئة بعد — كن أول من يهنّئ العروسين",
  envelopeEyebrow: (name) => `أهلًا ${name}`,
  envelopeCta: "افتح دعوتك",
  envelopeHint: "اضغط للفتح",
  openerAria: "افتح دعوتك",
  skip: "تخطّي",
  soundOn: "تشغيل الموسيقى",
  soundOff: "كتم الموسيقى",
  countdownAria: "الوقت المتبقي على المناسبة",
  countdownUnits: ["يوم", "ساعة", "دقيقة"],
  errorHelp: "لو الرابط وصلك من العروسين، تواصل معهم للحصول على رابط جديد.",
  noticeTitle: "قبل تأكيد الحضور",
  noticeOk: "موافق، أكمل التأكيد",
  noticeBack: "رجوع",
  wishNudge: "ولا تنسى، اترك رسالتك للعروسين 🤍",
  wishPromptTitle: { confirmed: "تم تأكيد حضورك", declined: "تم تسجيل ردّك" },
  wishPromptBody: "لا تنسَ أن تترك رسالتك للعروسين — كلماتك هدية تبقى معهم.",
  wishPromptOk: "حسنًا",
  wishPromptAdd: "اكتب رسالتك",
  previewBanner: "معاينة — جذي بتطلع الدعوة للضيف",
  previewAction: "هذي معاينة — الأزرار ما تسجّل أي شي",
};

const EN = {
  dir: "ltr",
  switchTo: "العربية",
  switchToLang: "ar",
  tabInvite: "Invitation",
  tabWall: "Congratulations",
  // Used when the couple has not written their families' names in English.
  // A card with the Arabic names in the middle of an English sentence reads
  // as unfinished; this reads as a sentence.
  familiesFallback: "The families of the bride and groom",
  partyIntro: (total) => `Your invitation includes ${total} guests`,
  partyYouAnd: (n) => `you and ${companionsEn(n)}`,
  partyQuestion: "How many will attend?",
  partyAria: "Number of guests attending",
  onlyYou: "Just you",
  confirm: "Confirm attendance",
  confirming: "Confirming...",
  decline: "Regretfully decline",
  confirmed: (n) => `Your attendance is confirmed${n ? ` with ${companionsEn(n)}` : ""}`,
  qrOnWhatsAppTitle: "Your entry pass is on its way",
  qrOnWhatsApp: "Your entry pass (QR) is being sent to you on WhatsApp now by the Da3wa team — please keep it to show at the door.",
  declined: "Your apology has been received — we hope to see you at another occasion",
  wishEdit: "Edit your message to the couple",
  wishPlaceholder: "Write your message or congratulations here...",
  wishSending: "Sending...",
  wishUpdate: "Update message",
  wishSend: "Send message",
  wishSent: "Your message has been sent — you can edit it any time.",
  wallTitle: "Congratulations",
  wallSubtitle: "From everyone sharing in the couple's joy",
  loading: "Loading...",
  wallEmpty: "No messages yet — be the first to congratulate the couple",
  envelopeEyebrow: (name) => `Welcome, ${name}`,
  envelopeCta: "Open your invitation",
  envelopeHint: "Tap to open",
  openerAria: "Open your invitation",
  skip: "Skip",
  soundOn: "Play music",
  soundOff: "Mute music",
  countdownAria: "Time remaining until the celebration",
  countdownUnits: ["Days", "Hours", "Minutes"],
  errorHelp: "If the couple sent you this link, ask them for a new one.",
  noticeTitle: "Before you confirm",
  noticeOk: "OK, continue",
  noticeBack: "Back",
  wishNudge: "And do leave the couple a message 🤍",
  wishPromptTitle: { confirmed: "Your attendance is confirmed", declined: "Thank you for letting us know" },
  wishPromptBody: "Don't forget to leave the couple a message — your words are a gift they will keep.",
  wishPromptOk: "OK",
  wishPromptAdd: "Write your message",
  previewBanner: "Preview — this is how guests will see the invitation",
  previewAction: "This is a preview — nothing is recorded",
};

export function inviteUi(lang) {
  return lang === "en" ? EN : AR;
}
