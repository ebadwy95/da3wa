import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { generateScannerCode } from "@/lib/token";

// Admin-only: add a new named door-scanner code to this event. A big
// wedding can have two or three people scanning at once — each gets their
// own code, and the admin types their name in next to it (NOT the security
// staff themselves — see src/app/api/scan-auth/route.js for why).
export async function POST(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود" };
    if (!event.scanners) event.scanners = [];
    const scanner = { id: randomUUID(), code: generateScannerCode(), name: "" };
    event.scanners.push(scanner);
    return { scanners: event.scanners };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ scanners: result.scanners });
}
