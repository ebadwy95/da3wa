import crypto from "crypto";

function getSecret() {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    // Don't hard-crash local dev if someone forgot to set it, but make it
    // obvious in the logs — this must be set for real deployments.
    console.warn(
      "[token] APP_SECRET is not set — using an insecure fallback. Set APP_SECRET in your environment."
    );
    return "insecure-dev-fallback-secret";
  }
  return secret;
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

// Per-guest invite token: guests open /invite/<id>?t=<token>
export function makeInviteToken(guestId) {
  return sign(`invite:${guestId}`).slice(0, 24);
}

export function verifyInviteToken(guestId, token) {
  if (!guestId || !token) return false;
  return makeInviteToken(guestId) === token;
}

// Signed check-in payload embedded in the guest's QR code. Encodes the
// guest id plus a signature so the door scanner can verify authenticity
// without a network round-trip to look up secrets.
export function makeCheckinCode(guestId) {
  const sig = sign(`checkin:${guestId}`).slice(0, 16);
  return `${guestId}.${sig}`;
}

// Per-event door-scanner session: lets a specific wedding's door staff log
// into /scan with a per-event code (NOT the platform admin password), and
// scopes their session to that one event — so if two weddings run the same
// day, one door's scanner session can never check in the other's guests.
export function makeScannerToken(eventId) {
  return sign(`scanner:${eventId}`).slice(0, 24);
}

export function verifyScannerToken(eventId, token) {
  if (!eventId || !token) return false;
  return makeScannerToken(eventId) === token;
}

// Generates a short, easy-to-type-or-share per-event scanner code (e.g.
// "A1B2C3D4"), created once when the event is made.
export function generateScannerCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function verifyCheckinCode(code) {
  if (!code || typeof code !== "string" || !code.includes(".")) {
    return { valid: false, guestId: null };
  }
  const [guestId, sig] = code.split(".");
  const expected = sign(`checkin:${guestId}`).slice(0, 16);
  const valid =
    sig?.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return { valid, guestId: valid ? guestId : null };
}
