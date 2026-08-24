// Date helpers for the event lifecycle (active -> archived-by-date ->
// deleted -> permanently hidden). Events store their date as a plain
// "YYYY-MM-DD" ISO date string (from a <input type="date">) going forward.
//
// Older events created before this field existed may still hold a free-text
// Arabic date (e.g. "20 نوفمبر 2026") entered by hand. We never try to guess
// a real date out of that text — the functions below simply treat it as
// "unknown" for archiving purposes until the admin re-saves the event with a
// real date via the edit form, at which point archiving starts working for
// it automatically. No data is lost or altered because of this either way.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

// "Today" as a plain date (local server time, midnight) — we only ever
// compare whole days here, never times.
function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysSince(isoDate, now = new Date()) {
  if (!isIsoDate(isoDate)) return null;
  const then = startOfDay(new Date(`${isoDate}T00:00:00`));
  const today = startOfDay(now);
  const diffMs = today.getTime() - then.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Auto-archive threshold: an event moves to the Archive view on its own,
// with no action needed, 3 full days after its date.
export function isArchivedByDate(isoDate, now = new Date()) {
  const days = daysSince(isoDate, now);
  return days !== null && days > 3;
}

// Whether the event's date is today or still in the future — required
// before a soft-deleted event can be recalled (restored).
export function isTodayOrFuture(isoDate, now = new Date()) {
  const days = daysSince(isoDate, now);
  // Unknown/legacy free-text dates are treated as "not in the past" so they
  // don't unfairly block a recall — the admin can fix the date afterwards.
  if (days === null) return true;
  return days <= 0;
}

export function daysSinceDeleted(deletedAt, now = new Date()) {
  if (!deletedAt) return null;
  const diffMs = now.getTime() - new Date(deletedAt).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// The three states an event can be in from the admin's point of view.
// "hidden" is never surfaced anywhere — those events are filtered out of
// every listing entirely (kept forever in storage, per product decision, but
// not shown again).
export function computeDisplayStatus(event, now = new Date()) {
  if (event.status === "deleted") {
    const since = daysSinceDeleted(event.deletedAt, now);
    return since !== null && since > 30 ? "hidden" : "deleted";
  }
  if (isArchivedByDate(event.eventDate, now)) return "archived";
  return "active";
}

// How many whole days from today until this date. Negative once it's past.
// Used by the reminder job, which fires on events exactly N days out.
export function daysUntil(isoDate, now = new Date()) {
  const since = daysSince(isoDate, now);
  return since === null ? null : -since;
}

const ISO_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isIsoTime(value) {
  return typeof value === "string" && ISO_TIME_RE.test(value);
}

// Formats a stored "HH:MM" (from <input type="time">) the way an Arabic
// wedding invitation says it — "8:00 مساءً". Western digits, matching the
// convention already used for dates elsewhere in this app.
export function formatEventTimeArabic(isoTime) {
  if (!isIsoTime(isoTime)) return isoTime || "";
  const [rawHour, minute] = isoTime.split(":");
  const hour24 = parseInt(rawHour, 10);
  const period = hour24 >= 12 ? "مساءً" : "صباحًا";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

// Timestamps in the admin feeds. toLocaleString("ar-EG") renders Arabic-Indic
// digits (٢٠٢٦/٨/٢٤), which clashes with the Western digits used for every
// other number in this app — guest counts, phone numbers, event dates. Same
// locale, same month names, digits that match everything around them.
export function formatDateTimeArabic(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ar", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      numberingSystem: "latn",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

// Formats a stored "YYYY-MM-DD" into a clean Arabic date for guests, e.g.
// "٢٠ نوفمبر ٢٠٢٦" -> we deliberately keep Western digits (already the
// convention used elsewhere in this app) and just localize the month name.
export function formatEventDateArabic(isoDate) {
  if (!isIsoDate(isoDate)) return isoDate || "";
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return new Intl.DateTimeFormat("ar", {
      day: "numeric",
      month: "long",
      year: "numeric",
      numberingSystem: "latn",
    }).format(d);
  } catch {
    return isoDate;
  }
}
