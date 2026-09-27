import { withDb } from "@/lib/db";

// "The guest opened their invitation."
//
// WhatsApp's own delivered/read receipts arrive over the provider's webhook,
// and not every plan carries one — Wati's Growth plan has no webhooks at all.
// That is survivable, because for a wedding the useful question was never
// "did the phone receive it" but "did they look at it": a guest who opened
// their card and has not answered is who the couple should be nudging.
//
// This is recorded from the invitation's own endpoint, on our own server. It
// costs nothing, works whoever is carrying the messages, and keeps working if
// the couple sent the link by hand from their own WhatsApp.

// The card fetches once per load, and a guest who reads it, closes it and
// comes back an hour later is two visits worth knowing about — but a reload
// while deciding is not. Repeat visits inside this window only refresh the
// timestamp, they don't count again.
const REVISIT_MS = 30 * 60 * 1000;

/**
 * Marks a guest's invitation as opened and returns the updated guest.
 * Returns null when the guest has disappeared between read and write.
 */
export async function recordInviteOpen(guestId) {
  return withDb((db) => {
    const guest = db.guests.find((g) => g.id === guestId);
    if (!guest) return null;

    const now = new Date();
    const last = guest.lastOpenedAt ? new Date(guest.lastOpenedAt) : null;
    const isRevisit = !last || now - last > REVISIT_MS;

    if (!guest.openedAt) guest.openedAt = now.toISOString();
    guest.lastOpenedAt = now.toISOString();
    if (isRevisit) guest.openCount = (guest.openCount || 0) + 1;

    return guest;
  });
}
