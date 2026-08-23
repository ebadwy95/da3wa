import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { verifyCheckinCode } from "@/lib/token";
import { isAdminAuthed } from "@/lib/auth";
import { getScannerSession } from "@/lib/scannerAuth";

// The door scanner posts the raw QR payload here. Two ways in: the platform
// admin password (full access, any event — for setup/testing), or a
// per-event scanner session from /api/scan-auth (scoped to ONE event, so a
// door scanning wedding A's QR codes can never check in wedding B's guests
// even if it somehow scanned one).
//
// A single QR is shared by the whole party (the guest + however many
// companions they confirmed). Rather than silently counting "1 more person
// in" the instant a camera decodes the code, checking someone in is a TWO
// STEP process:
//
//   1. mode "peek" (the default — what a fresh camera decode sends): decode
//      and validate the code, but make NO change to the database yet. If
//      the guest/party is valid and has room left, respond with
//      {pending:true, guestName, remaining, ...} so the door staff can see
//      how many are actually standing in front of them and choose a number
//      — the QR being merely scanned is never itself treated as an entry.
//      If validation fails outright (wrong event, already fully used,
//      declined, etc.) there's nothing to confirm, so that's logged and
//      returned as a normal rejection immediately.
//
//   2. mode "confirm": the door staff has explicitly entered how many
//      people are entering right now (1..remaining) and pressed confirm.
//      This is the only path that actually increments checkedInCount, and
//      the code is re-verified from scratch here too — the client's earlier
//      "peek" response is never trusted for the actual write.
//
// Every attempt that reaches a final outcome (a peek-time rejection, or a
// confirm) is written to checkinLogs together with which scanner-staff
// member's session made it, so if something looks like misuse at the door
// (e.g. repeated attempts on an already-used QR), there's a record of
// exactly who scanned it.
export async function POST(request) {
  const admin = await isAdminAuthed();
  const scannerSession = admin ? null : await getScannerSession();
  const scannerEventId = scannerSession?.eventId || null;
  const staffName = admin ? "مسؤول المنصة" : scannerSession?.staffName || "غير معروف";

  if (!admin && !scannerEventId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { code, mode, count } = await request.json().catch(() => ({}));
  const isConfirm = mode === "confirm";
  const { valid, guestId } = verifyCheckinCode(code);

  const result = await withDb((db) => {
    db.checkinLogs = db.checkinLogs || [];

    function logAndReturn(entry) {
      db.checkinLogs.unshift({
        id: randomUUID(),
        eventId: entry.eventId ?? scannerEventId ?? null,
        guestId: entry.guestId ?? null,
        guestName: entry.guestName ?? null,
        staffName,
        ok: entry.ok,
        reason: entry.reason ?? null,
        message: entry.message,
        createdAt: new Date().toISOString(),
      });
      // Bounded so it doesn't grow forever.
      db.checkinLogs = db.checkinLogs.slice(0, 500);
      return entry;
    }

    if (!valid) {
      return logAndReturn({
        ok: false,
        reason: "invalid",
        message: "رمز غير صالح — ليس رمز QR الخاص بهذه الدعوة",
      });
    }

    const guest = db.guests.find((g) => g.id === guestId);
    if (!guest) {
      return logAndReturn({ ok: false, reason: "not_found", message: "الضيف غير موجود", guestId });
    }

    if (scannerEventId && guest.eventId !== scannerEventId) {
      return logAndReturn({
        ok: false,
        reason: "wrong_event",
        message: "رمز الدخول هذا يخصّ زفافًا آخر — وليس من ضيوف الزفاف الذي سجَّل هذا الماسح الدخول عليه",
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    if (guest.status === "declined") {
      return logAndReturn({
        ok: false,
        reason: "declined",
        message: `اعتذر ${guest.name} عن الحضور`,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    if (guest.status !== "confirmed") {
      return logAndReturn({
        ok: false,
        reason: "not_confirmed",
        message: `لم يؤكد ${guest.name} الحضور بعد — لا يُفترض أن يكون لديه رمز QR أصلًا`,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    // Total people this ONE guest is allowed to bring through this QR —
    // the guest themself plus however many companions they confirmed.
    const partySize = 1 + (guest.confirmedCompanions || 0);
    const checkedInCount = guest.checkedInCount || 0;
    const remaining = partySize - checkedInCount;

    if (remaining <= 0) {
      return logAndReturn({
        ok: false,
        reason: "already_full",
        message: `اكتمل العدد المسموح به لـ ${guest.name} بالكامل (${partySize} من ${partySize}) — هذا الرمز مستخدَم بالكامل من قبل`,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
      });
    }

    if (!isConfirm) {
      // Just a peek — the camera saw a valid, not-yet-full QR. Nothing is
      // written to the database or the audit log yet; the door staff must
      // still explicitly choose a headcount and confirm.
      return {
        ok: true,
        pending: true,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.name,
        partySize,
        checkedInCount,
        remaining,
      };
    }

    // Confirm step: apply exactly how many people the staff said are
    // entering right now, clamped to what's actually still available so a
    // stale/incorrect count from the client can never over-admit.
    const requested = Math.max(1, parseInt(count, 10) || 1);
    const applied = Math.min(requested, remaining);

    guest.checkedInCount = checkedInCount + applied;
    guest.checkedIn = guest.checkedInCount >= partySize;
    if (!guest.checkedInAt) guest.checkedInAt = new Date().toISOString();
    guest.lastCheckedInAt = new Date().toISOString();

    const remainingAfter = partySize - guest.checkedInCount;
    const message =
      remainingAfter > 0
        ? `أهلًا — دخل ${applied} من ضيوف ${guest.name} (${guest.checkedInCount} من ${partySize}) — المتبقّي ${remainingAfter}`
        : `أهلًا ${guest.name} 🎉 (${guest.checkedInCount} من ${partySize}) — اكتمل العدد المسموح به`;

    return logAndReturn({
      ok: true,
      pending: false,
      message,
      eventId: guest.eventId,
      guestId: guest.id,
      guestName: guest.name,
      partySize,
      checkedInCount: guest.checkedInCount,
      remaining: remainingAfter,
    });
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
