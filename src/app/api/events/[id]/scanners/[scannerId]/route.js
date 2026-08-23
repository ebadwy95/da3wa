import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";

// Admin-only: assign/rename the staff member's name attached to a scanner
// code. The security staff themselves never type this — the admin controls
// it here, which is exactly what stops one staff member from checking guests
// in under someone else's name.
export async function PATCH(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id, scannerId } = await params;
  const { name } = await request.json().catch(() => ({}));

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود" };
    const scanner = (event.scanners || []).find((s) => s.id === scannerId);
    if (!scanner) return { error: "رمز السكانر غير موجود" };
    scanner.name = String(name || "").trim().slice(0, 60);
    return { scanners: event.scanners };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ scanners: result.scanners });
}

export async function DELETE(request, { params }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id, scannerId } = await params;

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return { error: "الزفاف غير موجود" };
    event.scanners = (event.scanners || []).filter((s) => s.id !== scannerId);
    return { scanners: event.scanners };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ scanners: result.scanners });
}
