// The sending app (/send): the groom and the bride sending every message from
// their own WhatsApp, one guest at a time, when the business number can't.
//
// Each guest goes through three messages in order — the invitation, the
// reminder, the thank-you — and the app shows one button per guest: whichever
// message is due next. There is no separate entry-pass message: the moment a
// guest confirms, their invitation link becomes their pass. A message has
// three states:
//
//   todo  — not sent yet; the button opens WhatsApp with it written out.
//   sent  — the button was pressed. WhatsApp tells nobody whether the send
//           button was then pressed, so this is "probably sent".
//   done  — the guest opened the link inside it. This is the proof, and it is
//           the only thing that turns the row green.
//
// The texts are the approved WhatsApp templates word for word, so a guest
// gets the same message whichever route it came by; only "attached above"
// becomes a link, because a hand-sent message carries no attachment.

import {
  makeInviteToken,
  makeGuestPageToken,
} from "@/lib/token";
import { resolveCoupleParts, coupleNamesIn } from "@/lib/couple";
import {
  formatEventDateArabic,
  formatEventDateEnglish,
  formatEventTimeArabic,
  formatEventTimeEnglish,
  isIsoDate,
} from "@/lib/date";
import { siteOrigin } from "@/lib/seo";

export const STEPS = ["invite", "reminder", "thanks"];

// Weddings are in Kuwait; the server runs on UTC. "Is the reminder open yet"
// is a question about the date on the couple's phone, not on the server.
const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;
export function kuwaitToday(now = new Date()) {
  return new Date(now.getTime() + KUWAIT_OFFSET_MS).toISOString().slice(0, 10);
}

function shiftDate(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * When the reminder and the thank-you open in the app. The reminder opens two
 * days before the wedding and the thank-you the day after, unless the admin
 * set another date — "ask the admin" is the way to send either one early.
 */
export function unlockDates(event) {
  const date = isIsoDate(event?.eventDate) ? event.eventDate : null;
  return {
    reminderFrom: event?.handSendReminderFrom || (date ? shiftDate(date, -2) : null),
    thanksFrom: event?.handSendThanksFrom || (date ? shiftDate(date, 1) : null),
  };
}

export function guestLinks(guestId) {
  const base = siteOrigin();
  return {
    invite: `${base}/invite/${guestId}?t=${makeInviteToken(guestId)}`,
    pass: `${base}/pass/${guestId}?t=${makeGuestPageToken(guestId, "pass")}`,
    map: `${base}/go/${guestId}?t=${makeGuestPageToken(guestId, "map")}`,
    thanks: `${base}/thanks/${guestId}?t=${makeGuestPageToken(guestId, "thanks")}`,
  };
}

/** The text each message sends, in the guest's language. */
export function messageFor(step, guest, event) {
  const en = guest.language === "en";
  const { groomName, brideName } = resolveCoupleParts(event);
  const couple = coupleNamesIn(event, en ? "en" : "ar");
  const links = guestLinks(guest.id);

  if (step === "invite") {
    return en
      ? `Hello ${guest.name}, ${couple} are delighted to invite you to celebrate their wedding with them. To confirm your attendance or send your apologies, please open your personal invitation:\n${links.invite}\nWe look forward to your reply.`
      : `مرحباً ${guest.name} 🌸، يتشرف ${groomName} و${brideName} بدعوتكم لمشاركتهما فرحة الزفاف. للتأكيد أو الاعتذار، يرجى الضغط على الرابط التالي:\n${links.invite}\nبانتظار ردكم بكل سرور 💍`;
  }
  if (step === "reminder") {
    const date = en ? formatEventDateEnglish(event.eventDate) : formatEventDateArabic(event.eventDate);
    const time = en ? formatEventTimeEnglish(event.eventTime) : formatEventTimeArabic(event.eventTime);
    const venue = (en && event.venueNameEn) || event.venueName || event.venueAddress || "";
    return en
      ? `Hello ${guest.name}, this is a kind reminder of the wedding celebration of ${couple}, which will take place on ${date} at ${time} at ${venue}. You can find the venue on the map using this link:\n${links.map}\nYour entry pass is on your invitation — please show it at the venue entrance:\n${links.invite}\nWe look forward to seeing you.`
      : `مرحبًا ${guest.name}، نودّ أن نذكّركم بموعد حفل زفاف ${groomName} و${brideName}، والذي سيُقام بإذن الله يوم ${date} في تمام الساعة ${time}، وذلك في ${venue}. يمكنكم الاطلاع على موقع القاعة على الخريطة من خلال الرابط التالي:\n${links.map}\nوبطاقة الدخول على رابط دعوتكم، نرجو التكرم بإبرازها عند باب القاعة:\n${links.invite}\nونتشرف بحضوركم.`;
  }
  // The template says "yesterday"; a hand-sent thank-you can go out any day
  // after, so the day is left out rather than risk being wrong.
  return en
    ? `Hello ${guest.name}, ${couple} thank you for attending their wedding. Your thank-you card is at the link below:\n${links.thanks}`
    : `مرحبًا ${guest.name}، يشكركم ${groomName} و${brideName} على حضوركم حفل زفافهما. بطاقة الشكر على الرابط التالي:\n${links.thanks}`;
}

export function whatsappLink(phone, text) {
  return `https://wa.me/${String(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/**
 * Where each of the guest's three messages stands. Returns
 * { invite, reminder, thanks } each { state, at, until }, with state one
 * of todo / sent / done / locked / skip, plus `current`: the step the guest's
 * button is for.
 */
export function guestSteps(guest, event, today = kuwaitToday()) {
  const tapped = guest.handSend || {};
  const declined = guest.status === "declined";
  const confirmed = guest.status === "confirmed";
  const { reminderFrom, thanksFrom } = unlockDates(event);

  const progress = (step, doneAt) => {
    if (doneAt) return { state: "done", at: doneAt };
    if (tapped[step]) return { state: "sent", at: tapped[step] };
    return { state: "todo" };
  };

  // Answering means they opened it, even if the visit predates open tracking.
  const answered = confirmed || declined;
  const steps = {
    invite: progress("invite", guest.openedAt || (answered ? guest.respondedAt || guest.createdAt : null)),
  };

  // The reminder carries two links — the map and the invitation (the pass);
  // either one opened after it was sent means it arrived.
  const reminderOpened =
    guest.reminderOpenedAt ||
    (tapped.reminder && guest.lastOpenedAt && guest.lastOpenedAt > tapped.reminder ? guest.lastOpenedAt : null);

  if (declined) {
    steps.reminder = steps.thanks = { state: "skip" };
  } else if (!confirmed) {
    steps.reminder = { state: "locked", reason: "waiting_rsvp" };
    steps.thanks = { state: "locked", reason: "waiting_rsvp" };
  } else {
    steps.reminder =
      reminderFrom && today < reminderFrom
        ? { state: "locked", reason: "date", until: reminderFrom }
        : progress("reminder", reminderOpened);
    steps.thanks =
      thanksFrom && today < thanksFrom
        ? { state: "locked", reason: "date", until: thanksFrom }
        : progress("thanks", guest.thanksViewedAt);
  }

  // The button belongs to the first message still to do. A message sent but
  // not yet opened doesn't hold the guest back once the next one is due — the
  // row keeps showing it as waiting, alongside the next button.
  let current = null;
  for (let i = 0; i < STEPS.length; i += 1) {
    const step = STEPS[i];
    const { state } = steps[step];
    if (state === "done" || state === "skip") continue;
    if (state === "sent") {
      const nextState = steps[STEPS[i + 1]]?.state;
      if (nextState === "todo" || nextState === "sent" || nextState === "done") continue;
    }
    current = step;
    break;
  }
  return { ...steps, current };
}
