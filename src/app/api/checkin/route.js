import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { verifyCheckinCode } from "@/lib/token";
import { isAdminAuthed } from "@/lib/auth";
import { getScannerEventId } from "@/lib/scannerAuth";

// The door scanner posts the raw QR payload here. Two ways in: the platform
// admin password (full access, any event — for setup/testing), or a
// per-event scanner session from /api/scan-auth (scoped to ONE event, so a
// door scanning wedding A's QR codes can never check in wedding B's guests
// even if it somehow scanned one).
export async function POST(request) {
  const admin = await isAdminAuthed();
  const scannerEventId = admin ? null : await getScannerEventId();

  if (!admin && !scannerEventId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { code } = await request.json().catch(() => ({}));
  const { valid, guestId } = verifyCheckinCode(code);

  if (!valid) {
    return NextResponse.json(
      { ok: false, reason: "invalid", message: "كود غير صالح — مش QR بتاع الدعوة دي" },
      { status: 400 }
    );
  }

  const result = await withDb((db) => {
    const guest = db.guests.find((g) => g.id === guestId);
    if (!guest) {
      return { ok: false, reason: "not_found", message: "الضيف غير موجود" };
    }
    if (scannerEventId && guest.eventId !== scannerEventId) {
      return {
        ok: false,
        reason: "wrong_event",
        message: "كود الدخول ده بتاع زفاف تاني — مش من ضيوف الزفاف اللي داخل عليه السكانر ده",
      };
    }
    if (guest.status === "declined") {
      return { ok: false, reason: "declined", message: `${guest.name} اعتذر عن الحضور`, guest };
    }
    if (guest.checkedIn) {
      return {
        ok: false,
        reason: "already_checked_in",
        message: `${guest.name} داخل بالفعل الساعة ${new Date(guest.checkedInAt).toLocaleTimeString("ar-EG")}`,
        guest,
      };
    }
    guest.checkedIn = true;
    guest.checkedInAt = new Date().toISOString();
    return { ok: true, message: `أهلاً ${guest.name} 🎉`, guest };
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
