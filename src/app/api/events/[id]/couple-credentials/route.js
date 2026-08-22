import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { generateCouplePassword } from "@/lib/token";

// Admin-only: re-issue a fresh password for a couple who lost/forgot
// theirs. The username stays the same. The couple is forced to change it
// again on their next login (mustChangePassword), same as a brand-new event.
export async function POST(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود" };
    event.couplePassword = generateCouplePassword();
    event.mustChangePassword = true;
    return { event };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({
    coupleUsername: result.event.coupleUsername,
    couplePassword: result.event.couplePassword,
  });
}
