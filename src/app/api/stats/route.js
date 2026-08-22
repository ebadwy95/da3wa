import { NextResponse } from "next/server";
import { getDb, isUsingRedis } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

export async function GET(request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  const db = await getDb();
  const guests = eventId ? db.guests.filter((g) => g.eventId === eventId) : db.guests;

  const stats = {
    invited: guests.length,
    confirmed: guests.filter((g) => g.status === "confirmed").length,
    declined: guests.filter((g) => g.status === "declined").length,
    pending: guests.filter((g) => g.status === "pending").length,
    checkedIn: guests.filter((g) => g.checkedIn).length,
    expectedAttendees: guests
      .filter((g) => g.status === "confirmed")
      .reduce((sum, g) => sum + 1 + (g.confirmedCompanions || 0), 0),
    storage: isUsingRedis() ? "upstash-redis" : "local-json",
  };

  return NextResponse.json({ stats });
}
