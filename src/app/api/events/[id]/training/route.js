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
// Every outcome a door actually produces, in the order the staff should meet
// them: the clean entry first, then the two that look like mistakes and are
// not, then the four refusals. They scan them off a second phone the week
// before and learn what each answer looks like — the alarm included — while
// every one of them is answered by /api/checkin without reading or writing a
// single guest.
export const dynamic = "force-dynamic";

const DRILLS = [
  {
    variant: "ok",
    label: "١. بطاقة سليمة",
    hint: "أخضر. يسألك كم واحد داخل الحين — اختر العدد واضغط تأكيد.",
  },
  {
    variant: "partial",
    label: "٢. دخول جزئي",
    hint: "بطاقة لأربعة ودخل منهم اثنان. ما يصير تدخّل أربعة — الباقي اثنان بس.",
  },
  {
    variant: "returning",
    label: "٣. خرج ورجع",
    hint: "ضيف طلع برّا ورجع. يدخل عادي وما تنبّه الأمن — جرّبها من تبويب «دخول».",
  },
  {
    variant: "used",
    label: "٤. بطاقة مستخدمة",
    hint: "أحمر. هذي اللي ترنّ لفريق الأمن في العرس الحقيقي — ما تدخّله واتصل فيهم.",
  },
  {
    variant: "declined",
    label: "٥. ضيف معتذر",
    hint: "أحمر. الضيف نفسه قال ما راح يحضر.",
  },
  {
    variant: "withdrawn",
    label: "٦. دعوة ملغاة",
    hint: "أحمر. انشال من القائمة بعد ما وصلته البطاقة — رجّعه لأهل العروسين بأدب.",
  },
  {
    variant: "forged",
    label: "٧. رمز مو من العرس",
    hint: "أحمر. سكرين شوت أو رمز من مكان ثاني — ما يدخل أبدًا.",
  },
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
