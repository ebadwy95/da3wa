import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { getCoupleEventId } from "@/lib/coupleAuth";

// Called both for the mandatory first-login password change (mustChangePassword)
// and for a couple voluntarily changing their password later.
export async function POST(request) {
  const eventId = await getCoupleEventId();
  if (!eventId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { newPassword } = await request.json().catch(() => ({}));
  const clean = String(newPassword || "").trim();
  if (clean.length < 4) {
    return NextResponse.json(
      { error: "يجب أن تتكوّن كلمة المرور الجديدة من 4 حروف/أرقام على الأقل" },
      { status: 400 }
    );
  }

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return { error: "الزفاف غير موجود" };
    event.couplePassword = clean;
    event.mustChangePassword = false;
    return { ok: true };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}
