import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { canAccessEvent } from "@/lib/coupleAuth";
import { isAdminAuthed } from "@/lib/auth";
import { getScannerSession } from "@/lib/scannerAuth";
import { resolveGuard } from "@/lib/security";
import { makeTrainingCode } from "@/lib/token";

// Practice passes for the door staff.
//
// Three codes, because three things happen at a door: a pass that is fine, a
// pass that has already been used, and a guest who said they weren't coming.
// The team scan them off a second phone the week before and learn what each
// answer looks like — the alarm included — while every one of them is
// answered by /api/checkin without reading or writing a single guest.
export const dynamic = "force-dynamic";

const DRILLS = [
  { variant: "ok", label: "بطاقة سليمة", hint: "لازم يطلع أخضر ويسألك عن العدد الداخل." },
  {
    variant: "used",
    label: "بطاقة مستخدمة",
    hint: "لازم يطلع أحمر — ودي الحالة اللي بترنّ لفريق الأمن في العرس الحقيقي.",
  },
  { variant: "declined", label: "ضيف معتذر", hint: "لازم يطلع أحمر ويقول إن الضيف اعتذر." },
];

export async function GET(request, { params }) {
  const { id: eventId } = await params;
  const key = new URL(request.url).searchParams.get("key");

  let allowed = (await isAdminAuthed()) || (await canAccessEvent(eventId));
  if (!allowed) {
    const scanner = await getScannerSession();
    allowed = scanner?.eventId === eventId;
  }
  if (!allowed && key) {
    const guard = resolveGuard(await getDb(), key);
    allowed = guard?.event?.id === eventId;
  }
  if (!allowed) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const codes = await Promise.all(
    DRILLS.map(async (drill) => ({
      ...drill,
      qr: await QRCode.toDataURL(makeTrainingCode(eventId, drill.variant), {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 420,
      }),
    }))
  );

  return NextResponse.json({ codes });
}
