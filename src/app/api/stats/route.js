import { NextResponse } from "next/server";
import { getDb, isUsingRedis } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  // A couple session may only ever request stats scoped to their own event;
  // an unscoped (whole-platform) request requires the platform admin.
  const authed = eventId ? await canAccessEvent(eventId) : await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const db = await getDb();
  const guests = eventId ? db.guests.filter((g) => g.eventId === eventId) : db.guests;

  const stats = {
    invited: guests.length,
    confirmed: guests.filter((g) => g.status === "confirmed").length,
    declined: guests.filter((g) => g.status === "declined").length,
    pending: guests.filter((g) => g.status === "pending").length,
    // "checkedIn" = عدد الدعوات (العائلات) اللي دخلت بالكامل. "peopleCheckedIn"
    // = إجمالي عدد الأفراد اللي دخلوا فعلاً من كل الدعوات (شامل الدخول الجزئي)
    // — الرقم الأدق لعدد اللي واقفين جوا القاعة دلوقتي.
    checkedIn: guests.filter((g) => g.checkedIn).length,
    peopleCheckedIn: guests.reduce((sum, g) => sum + (g.checkedInCount || 0), 0),
    expectedAttendees: guests
      .filter((g) => g.status === "confirmed")
      .reduce((sum, g) => sum + 1 + (g.confirmedCompanions || 0), 0),
    storage: isUsingRedis() ? "upstash-redis" : "local-json",
  };

  return NextResponse.json({ stats });
}
