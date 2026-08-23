import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { daysSinceDeleted, isTodayOrFuture } from "@/lib/date";

// Admin-only: restore ("recall") a soft-deleted event out of the archive.
// Two guards, per product decision:
//   1. Only within 30 days of deletion — after that the event has quietly
//      stopped appearing anywhere and can no longer be recalled.
//   2. Only if the wedding's date is today or still in the future — an
//      event whose date has already passed cannot simply be un-deleted
//      as-is; the admin must first edit its date to a future one (PATCH
//      /api/events/[id], which works regardless of status) and then call
//      this endpoint again.
export async function POST(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود" };
    if (event.status !== "deleted") {
      return { error: "هذا الزفاف ليس محذوفًا أصلًا" };
    }
    const since = daysSinceDeleted(event.deletedAt);
    if (since !== null && since > 30) {
      return {
        error:
          "تعذّر الاسترجاع — مرّت أكثر من 30 يومًا على حذف هذا الزفاف، ولم يعد بالإمكان استرجاعه",
      };
    }
    if (!isTodayOrFuture(event.eventDate)) {
      return {
        error:
          "تعذّر الاسترجاع لأن تاريخ هذا الزفاف قد مضى بالفعل — عدّل التاريخ إلى تاريخ مستقبلي أولًا من تعديل تفاصيل الزفاف، ثم أعد المحاولة",
      };
    }
    event.status = "active";
    event.deletedAt = null;
    return { event };
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "الزفاف غير موجود" ? 404 : 400 }
    );
  }
  return NextResponse.json({ ok: true, event: result.event });
}
