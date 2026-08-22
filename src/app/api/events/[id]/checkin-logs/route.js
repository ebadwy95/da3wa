import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { canAccessEvent } from "@/lib/coupleAuth";

// Read-only audit trail of every door-scan attempt for this event (accepted
// or rejected), including which scanner-staff member made it — lets the
// admin or the couple themselves see live who actually walked in, and spot
// anything that looks like someone trying to reuse an already-used QR.
export async function GET(request, { params }) {
  const { id: eventId } = await params;
  if (!(await canAccessEvent(eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const db = await getDb();
  const logs = (db.checkinLogs || []).filter((l) => l.eventId === eventId).slice(0, 100);
  return NextResponse.json({ logs });
}
