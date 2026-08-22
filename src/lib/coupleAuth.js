import { cookies } from "next/headers";
import { makeCoupleToken, verifyCoupleToken } from "./token";
import { isAdminAuthed } from "./auth";

// Shared by /api/couple-auth (login/logout) and every guest-management route
// that a couple should be able to use for THEIR OWN event only (add guests,
// bulk upload, send invites, view stats/feed) — see canAccessEvent below.
export const COUPLE_COOKIE_NAME = "da3wa_couple";

export async function getCoupleEventId() {
  const store = await cookies();
  const raw = store.get(COUPLE_COOKIE_NAME)?.value;
  if (!raw || !raw.includes(".")) return null;
  const [eventId, token] = raw.split(".");
  return verifyCoupleToken(eventId, token) ? eventId : null;
}

export async function createCoupleSession(eventId) {
  const store = await cookies();
  store.set(COUPLE_COOKIE_NAME, `${eventId}.${makeCoupleToken(eventId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearCoupleSession() {
  const store = await cookies();
  store.delete(COUPLE_COOKIE_NAME);
}

// True if the current request is allowed to manage this specific event:
// either the platform admin (full access to everything), or a couple
// session scoped to exactly this event.
export async function canAccessEvent(eventId) {
  if (await isAdminAuthed()) return true;
  const coupleEventId = await getCoupleEventId();
  return Boolean(coupleEventId) && coupleEventId === eventId;
}
