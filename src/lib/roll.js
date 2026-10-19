// "لن يحضر": a guest taken off the roll without being deleted.
//
// Deleting them loses the link, and the invitation is already on their phone
// — they would tap it and land on a dead page with no explanation. This keeps
// the invitation reachable and tells them plainly that it is closed, while
// taking them out of every number the couple plan from and out of everything
// the system still has to send.
//
// Kept as a stamp of its own rather than a fourth status, so the three
// answers (pending, confirmed, declined) stay what the guest said and this
// stays what the couple decided. A guest who had confirmed keeps that answer
// on record underneath, which is what makes putting them back one click
// rather than a conversation.

export function isWithdrawn(guest) {
  return Boolean(guest?.withdrawnAt);
}

/** The guests who still count — everyone who hasn't been taken off. */
export function onRoll(guests) {
  return (guests || []).filter((g) => !g?.withdrawnAt);
}
