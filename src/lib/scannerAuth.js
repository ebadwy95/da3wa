import { cookies } from "next/headers";
import { makeScannerToken, verifyScannerToken } from "./token";

// Shared by /api/scan-auth (login/logout) and /api/checkin (enforcement).
// See the comment in src/app/api/scan-auth/route.js for the "why".
export const SCANNER_COOKIE_NAME = "da3wa_scanner";

// A wedding can have several people scanning at the door at once (a big
// wedding might have 2-3). Each one logs in with the same shared event code
// but also types their own name, which travels with the session so every
// check-in they make is attributed to them in the audit log — if something
// looks like misuse at the door, we know exactly who did it.
function encodeStaffName(staffName) {
  return Buffer.from(staffName || "", "utf-8").toString("base64");
}

function decodeStaffName(encoded) {
  try {
    return Buffer.from(encoded || "", "base64").toString("utf-8");
  } catch {
    return "";
  }
}

export async function getScannerSession() {
  const store = await cookies();
  const raw = store.get(SCANNER_COOKIE_NAME)?.value;
  if (!raw || !raw.includes(".")) return null;
  const [eventId, token, encodedStaffName] = raw.split(".");
  if (!verifyScannerToken(eventId, token)) return null;
  return { eventId, staffName: decodeStaffName(encodedStaffName) };
}

export async function getScannerEventId() {
  const session = await getScannerSession();
  return session ? session.eventId : null;
}

export async function createScannerSession(eventId, staffName) {
  const store = await cookies();
  const value = `${eventId}.${makeScannerToken(eventId)}.${encodeStaffName(staffName)}`;
  store.set(SCANNER_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h — a single wedding day plus margin
  });
}

export async function clearScannerSession() {
  const store = await cookies();
  store.delete(SCANNER_COOKIE_NAME);
}
