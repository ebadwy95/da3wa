import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { generateScannerCode } from "@/lib/token";

// The stand at a trade show.
//
// Selling this by describing it does not work: "guests confirm on WhatsApp
// and you get a live headcount" is a sentence every supplier at the show is
// saying some version of. What works is handing someone a phone, watching
// them confirm as a guest, and the number on the tablet beside them moving
// while they are still holding it. People do not believe the pitch; they
// believe the number changing.
//
// So this is a real wedding with real guests, real links and a real scanner
// code — nothing simulated — that can be put back to its starting state in
// one press between visitors.
//
// Every id here is fixed rather than generated. A QR code printed on a
// business card has to still open the same invitation in six months, and a
// demo whose links die when the server restarts is worse than no demo.

export const DEMO_EVENT_ID = "da3wa-demo-event-0000-000000000001";
export const DEMO_SCANNER_ID = "da3wa-demo-scan-0000-000000000001";

// Four guests is enough to show every state the dashboard can be in, and few
// enough that a visitor takes it all in at a glance.
const DEMO_GUESTS = [
  {
    id: "da3wa-demo-guest-0000-000000000001",
    name: "ضيف المعرض",
    phone: "96500000001",
    maxCompanions: 3,
    side: "groom",
    // The one the visitor opens. Starts unanswered, every time.
    lead: true,
  },
  { id: "da3wa-demo-guest-0000-000000000002", name: "خالد المطيري", phone: "96500000002", maxCompanions: 1, side: "groom", status: "confirmed", confirmedCompanions: 1 },
  { id: "da3wa-demo-guest-0000-000000000003", name: "نورة العلي", phone: "96500000003", maxCompanions: 2, side: "bride", status: "confirmed", confirmedCompanions: 2 },
  { id: "da3wa-demo-guest-0000-000000000004", name: "سارة الرشيد", phone: "96500000004", maxCompanions: 0, side: "bride", status: "declined" },
];

function freshGuest(spec) {
  return {
    id: spec.id,
    eventId: DEMO_EVENT_ID,
    name: spec.name,
    phone: spec.phone,
    phoneDisplay: `+${spec.phone}`,
    maxCompanions: spec.maxCompanions,
    language: "ar",
    side: spec.side,
    kind: "invite",
    status: spec.status || "pending",
    confirmedCompanions: spec.confirmedCompanions ?? null,
    checkedIn: false,
    checkedInCount: 0,
    checkedInAt: null,
    lastCheckedInAt: null,
    steppedOutCount: 0,
    qrDataUrl: null,
    // Marked as sent so the demo dashboard never offers to message a number
    // that does not exist.
    invitedAt: new Date().toISOString(),
    invitedByHand: new Date().toISOString(),
    openedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    withdrawnAt: null,
    createdAt: new Date().toISOString(),
  };
}

function freshEvent() {
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return {
    id: DEMO_EVENT_ID,
    groomPhone: "96500000000",
    groomPhoneDisplay: "+96500000000",
    groomName: "عبدالله",
    brideName: "لطيفة",
    coupleNames: "عبدالله و لطيفة",
    eventDate: inTwoWeeks.toISOString().slice(0, 10),
    eventTime: "20:00",
    inviteVideoUrl: "",
    invitePosterUrl: "",
    inviteAudioUrl: "",
    inviteTheme: "light",
    venueName: "قاعة الماس",
    venueAddress: "الكويت",
    venueMapUrl: "https://maps.google.com/?q=29.3759,47.9774",
    welcomeMessage: "",
    packageLimit: 250,
    status: "active",
    deletedAt: null,
    coupleUsername: "demo",
    couplePassword: "da3wa-demo",
    mustChangePassword: false,
    // Automatic messages off, always. Nothing here has a real number behind
    // it, and a cron that tries anyway spends the account's reputation on
    // four invented people.
    autoMessagesOff: true,
    scanners: [{ id: DEMO_SCANNER_ID, code: "DEMO2026", name: "موظف المعرض", phone: null }],
    securityContacts: [],
    nameList: {
      groom: [{ id: randomUUID(), name: "فهد العتيبي", phone: null }],
      bride: [{ id: randomUUID(), name: "منيرة الدوسري", phone: null }],
    },
    nameListLimit: 20,
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
}

/**
 * The demo wedding, created if it isn't there. Safe to call on every page
 * view: it only writes when something is missing.
 */
export async function ensureDemo() {
  return withDb((db) => {
    db.events = db.events || [];
    db.guests = db.guests || [];
    let event = db.events.find((e) => e.id === DEMO_EVENT_ID);
    if (!event) {
      event = freshEvent();
      db.events.push(event);
    }
    for (const spec of DEMO_GUESTS) {
      if (!db.guests.some((g) => g.id === spec.id)) db.guests.push(freshGuest(spec));
    }
    return { event, guests: db.guests.filter((g) => g.eventId === DEMO_EVENT_ID) };
  });
}

/** Back to the start, for the next visitor. */
export async function resetDemo() {
  return withDb((db) => {
    db.events = db.events || [];
    db.guests = (db.guests || []).filter((g) => g.eventId !== DEMO_EVENT_ID);
    const i = db.events.findIndex((e) => e.id === DEMO_EVENT_ID);
    const event = freshEvent();
    if (i === -1) db.events.push(event);
    else db.events[i] = event;
    for (const spec of DEMO_GUESTS) db.guests.push(freshGuest(spec));
    // The stand's own check-ins and messages go with it.
    db.checkinLogs = (db.checkinLogs || []).filter((l) => l.eventId !== DEMO_EVENT_ID);
    db.messages = (db.messages || []).filter((m) => m.eventId !== DEMO_EVENT_ID);
    return { ok: true };
  });
}

export function demoLeadGuestId() {
  return DEMO_GUESTS.find((g) => g.lead).id;
}
