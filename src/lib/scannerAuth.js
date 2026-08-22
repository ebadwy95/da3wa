import { cookies } from "next/headers";
import { makeScannerToken, verifyScannerToken } from "./token";

// Shared by /api/scan-auth (login/logout) and /api/checkin (enforcement).
// See the comment in src/app/api/scan-auth/route.js for the "why".
export const SCANNER_COOKIE_NAME = "da3wa_scanner";

export async function getScannerEventId() {
  const store = await cookies();
  const raw = store.get(SCANNER_COOKIE_NAME)?.value;
  if (!raw || !raw.includes(".")) return null;
  const [eventId, token] = raw.split(".");
  return verifyScannerToken(eventId, token) ? eventId : null;
}

export async function createScannerSession(eventId) {
  const store = await cookies();
  store.set(SCANNER_COOKIE_NAME, `${eventId}.${makeScannerToken(eventId)}`, {
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
