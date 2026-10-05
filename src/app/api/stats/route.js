import { NextResponse } from "next/server";
import { getDb, isUsingRedis } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";
import { guestKind } from "@/lib/guestKind";

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
  const everyone = eventId ? db.guests.filter((g) => g.eventId === eventId) : db.guests;
  // The family's cards and the sharing cards are counted on their own: they
  // aren't invitations waiting on an answer.
  const guests = everyone.filter((g) => guestKind(g) === "invite");

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
    family: everyone.filter((g) => guestKind(g) === "family").length,
    // How many people the family cards are for — they come without a pass,
    // so this is the only place they are counted.
    familyPeople: everyone
      .filter((g) => guestKind(g) === "family")
      .reduce((sum, g) => sum + 1 + (g.maxCompanions || 0), 0),
    share: everyone.filter((g) => guestKind(g) === "share").length,
    storage: isUsingRedis() ? "upstash-redis" : "local-json",
  };

  return NextResponse.json({ stats });
}
