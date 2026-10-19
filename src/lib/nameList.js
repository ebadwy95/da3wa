// The door list: people who come in by name, with no code to scan.
//
// Every other guest arrives holding a pass. These are the ones who never had
// one — the couple's own families and the handful of people you cannot ask to
// tap a link — and until now the door had no way of knowing who they were.
// The groom keeps one list and the bride keeps another, each capped, and both
// are read-only everywhere the door can see them.
//
// A phone number is optional: half of these people are an uncle the couple
// would never ring on the night. A family name is not. "محمد" at a door with
// four hundred people through it is not a name, it is a guess — so every
// entry has to be at least two words, and the form says so rather than
// splitting the question into two boxes nobody fills in the same way.

import { randomUUID } from "crypto";
import { normalizePhone } from "@/lib/phone";

export const LIST_SIDES = ["groom", "bride"];
export const DEFAULT_LIST_LIMIT = 20;

export function listLimit(event) {
  const n = parseInt(event?.nameListLimit, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LIST_LIMIT;
}

export function nameListFor(event, side) {
  const list = event?.nameList?.[side];
  return Array.isArray(list) ? list : [];
}

export function bothLists(event) {
  return {
    groom: nameListFor(event, "groom"),
    bride: nameListFor(event, "bride"),
    limit: listLimit(event),
  };
}

/** Collapses the runs of spaces people paste in, so counting words is honest. */
function tidy(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * At least two words, each a real one. Returns the tidied name, or null.
 *
 * A single token is refused however long it is: "عبدالرحمن" alone still does
 * not tell the door which عبدالرحمن is standing in front of them.
 */
export function fullName(raw) {
  const name = tidy(raw);
  const parts = name.split(" ");
  if (parts.length < 2) return null;
  if (parts.some((p) => p.length < 2)) return null;
  return name;
}

/**
 * Cleans one side's list for storage.
 * Returns { entries } or { error } — never a half-written list.
 */
export function normaliseList(raw, limit) {
  if (!Array.isArray(raw)) return { error: "القائمة غير صالحة" };
  if (raw.length > limit) {
    return { error: `الحد الأقصى ${limit} اسم — احذف واحدًا قبل ما تضيف غيره` };
  }

  const entries = [];
  for (const item of raw) {
    const name = fullName(item?.name);
    if (!name) {
      return {
        error: `"${tidy(item?.name) || "بدون اسم"}" — اكتب الاسم الأول واسم العائلة`,
      };
    }
    // Optional, and a bad one is worth saying out loud rather than dropping:
    // a number typed wrong is someone believing they can be reached.
    let phoneDisplay = null;
    const typed = tidy(item?.phone);
    if (typed) {
      const parsed = normalizePhone(typed);
      if (!parsed.valid) return { error: `${name} — ${parsed.error}` };
      phoneDisplay = parsed.e164;
    }
    entries.push({ id: item?.id || randomUUID(), name, phone: phoneDisplay });
  }
  return { entries };
}

/** Writes one side's list onto the event, leaving the other side alone. */
export function putList(event, side, entries) {
  event.nameList = event.nameList || {};
  for (const s of LIST_SIDES) {
    if (!Array.isArray(event.nameList[s])) event.nameList[s] = [];
  }
  event.nameList[side] = entries;
}
