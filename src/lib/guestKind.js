// What a guest's link is for.
//
//   invite — the ordinary invitation: confirm, entry pass, the door.
//   family — the couple's own family, coming without a pass or a scan. They
//            get a card of their own, words written for them, not the
//            wedding's details: they know where and when.
//   share  — loved ones who can't come (abroad, far away): a card sharing the
//            joy, with room to leave their congratulations.
//
// Only "invite" guests answer, count towards attendance, or have a pass.
export const GUEST_KINDS = ["invite", "family", "share"];

export const KIND_LABEL = { invite: "دعوة", family: "أهل الفرح", share: "مشاركة الفرحة" };

const KIND_WORDS = {
  invite: ["invite", "invitation", "دعوة", "دعوه", "عادي", "عادية"],
  family: ["family", "vip", "اهل", "أهل", "الاهل", "الأهل", "اهل الفرح", "أهل الفرح", "عائلة", "عائله"],
  share: ["share", "abroad", "مشاركة", "مشاركه", "مشاركة الفرحة", "مشاركة الفرحه", "برا", "بره", "خارج"],
};

/** The kind from whatever was typed; "invite" when empty, null when unreadable. */
export function normaliseKind(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "invite";
  for (const [kind, words] of Object.entries(KIND_WORDS)) {
    if (words.includes(v)) return kind;
  }
  return null;
}

export function guestKind(guest) {
  return GUEST_KINDS.includes(guest?.kind) ? guest.kind : "invite";
}

export function isInvite(guest) {
  return guestKind(guest) === "invite";
}
