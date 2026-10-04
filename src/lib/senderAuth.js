import { cookies } from "next/headers";
import { getDb } from "./db";
import { makeSenderToken } from "./token";

// Sessions for the sending app (/send): the groom and the bride each log in
// with their own username and password, set by the platform admin, and each
// sees only their own side's guests. Kept apart from the couple dashboard's
// login on purpose — this app sends, it does not manage.
export const SENDER_COOKIE_NAME = "da3wa_sender";
export const SIDES = ["groom", "bride"];

export async function getSenderSession() {
  const store = await cookies();
  const raw = store.get(SENDER_COOKIE_NAME)?.value;
  if (!raw) return null;
  const [eventId, side, token] = raw.split(".");
  if (!SIDES.includes(side)) return null;
  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId && e.status !== "deleted");
  const account = event?.senders?.[side];
  if (!account?.password || makeSenderToken(eventId, side, account.password) !== token) return null;
  return { eventId, side, event };
}

export async function createSenderSession(eventId, side, password) {
  const store = await cookies();
  store.set(SENDER_COOKIE_NAME, `${eventId}.${side}.${makeSenderToken(eventId, side, password)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // the weeks between the invitations and the thank-you
  });
}

export async function clearSenderSession() {
  const store = await cookies();
  store.delete(SENDER_COOKIE_NAME);
}
