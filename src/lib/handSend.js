// The sending app (/send): the groom and the bride sending the invitation
// from their own WhatsApp, one guest at a time, when the business number
// can't.
//
// One message per guest before the wedding. Everything else lives on the
// link it carries: the guest confirms there, the same link becomes their entry
// pass, the venue's map is on it, and "add to calendar" on the pass has the
// phone remind them — so nothing needs sending a second time. After the
// wedding there is one optional thank-you, pointing at the same link (below).
//
// The invitation has three states:
//
//   todo  — not sent yet; the button opens WhatsApp with it written out.
//   sent  — the button was pressed. WhatsApp tells nobody whether the send
//           button was then pressed, so this is "probably sent".
//   done  — the guest opened the link. This is the proof, and the only thing
//           that turns the row green.
//
// The text is the approved WhatsApp template word for word, so a guest gets
// the same message whichever route it came by.

import { makeInviteToken } from "@/lib/token";
import { resolveCoupleParts, coupleNamesIn } from "@/lib/couple";
import { siteOrigin } from "@/lib/seo";
import { guestKind } from "@/lib/guestKind";

export const STEPS = ["invite", "thanks"];

export function inviteLink(guestId) {
  return `${siteOrigin()}/invite/${guestId}?t=${makeInviteToken(guestId)}`;
}

/** The invitation text, in the guest's language. */
export function inviteMessage(guest, event) {
  const en = guest.language === "en";
  const { groomName, brideName } = resolveCoupleParts(event);
  const link = inviteLink(guest.id);
  const kind = guestKind(guest);
  if (kind === "family") {
    return en
      ? `Hello ${guest.name} 🤍, our joy is not complete without you. ${coupleNamesIn(event, "en")} have a card especially for you:\n${link}`
      : `مرحباً ${guest.name} 🤍، فرحتنا ما تكتمل إلا بكم. يسعد ${groomName} و${brideName} أن يهدوكم هذه البطاقة الخاصة:\n${link}`;
  }
  if (kind === "share") {
    return en
      ? `Hello ${guest.name} 🤍, however far apart we are, ${coupleNamesIn(event, "en")} want to share their wedding joy with you:\n${link}`
      : `مرحباً ${guest.name} 🤍، حتى لو فرّقتنا المسافات، يسعد ${groomName} و${brideName} مشاركتكم فرحة زفافهما:\n${link}`;
  }
  return en
    ? `Hello ${guest.name}, ${coupleNamesIn(event, "en")} are delighted to invite you to celebrate their wedding with them. To confirm your attendance or send your apologies, please open your personal invitation:\n${link}\nWe look forward to your reply.`
    : `مرحباً ${guest.name} 🌸، يتشرف ${groomName} و${brideName} بدعوتكم لمشاركتهما فرحة الزفاف. للتأكيد أو الاعتذار، يرجى الضغط على الرابط التالي:\n${link}\nبانتظار ردكم بكل سرور 💍`;
}

export function whatsappLink(phone, text) {
  return `https://wa.me/${String(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/**
 * Where the guest stands, as one word the app can colour:
 * todo, sent, opened (no answer yet), confirmed or declined.
 */
export function guestStage(guest) {
  // A card with nothing to answer is done once it has been opened.
  if (guestKind(guest) !== "invite") {
    if (guest.openedAt) return "seen";
    return guest.handSend?.invite ? "sent" : "todo";
  }
  if (guest.status === "confirmed") return "confirmed";
  if (guest.status === "declined") return "declined";
  if (guest.openedAt) return "opened";
  if (guest.handSend?.invite) return "sent";
  return "todo";
}

// ---- The thank-you, the one message after the wedding ----
//
// Optional, and sent whenever the couple likes once the wedding is over. It
// points at the same invitation link, which shows the thank-you card on top
// from the day after the wedding — still one link per guest, for everything.

// Weddings are in Kuwait; the server runs on UTC.
const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Weddings run past midnight, and a guest arriving at half past twelve still
// needs their entry pass on top — so the thank-you takes over the link at six
// in the morning after the wedding, not at midnight.
const THANKS_FROM_HOUR = "06:00";

function nextDay(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** True from 6am (Kuwait) the morning after the wedding. */
export function thanksOpen(event, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event?.eventDate || "")) return false;
  const kuwaitNow = new Date(now.getTime() + KUWAIT_OFFSET_MS).toISOString().slice(0, 16);
  return kuwaitNow >= `${nextDay(event.eventDate)}T${THANKS_FROM_HOUR}`;
}

export function thanksMessage(guest, event) {
  const en = guest.language === "en";
  const { groomName, brideName } = resolveCoupleParts(event);
  const link = inviteLink(guest.id);
  return en
    ? `Hello ${guest.name}, ${coupleNamesIn(event, "en")} thank you for attending their wedding. Your thank-you card is on your invitation:\n${link}`
    : `مرحبًا ${guest.name}، يشكركم ${groomName} و${brideName} على حضوركم حفل زفافهما. بطاقة الشكر على رابط دعوتكم:\n${link}`;
}

/**
 * The thank-you for this guest: null when it doesn't apply (not confirmed,
 * or the wedding isn't over), otherwise todo / sent / done — done once the
 * guest opened their link after it was sent.
 */
export function thanksState(guest, event, now = new Date()) {
  if (guest.status !== "confirmed" || !thanksOpen(event, now)) return null;
  const sentAt = guest.handSend?.thanks;
  if (!sentAt) return "todo";
  return guest.lastOpenedAt && guest.lastOpenedAt > sentAt ? "done" : "sent";
}
