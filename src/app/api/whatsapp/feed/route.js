import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { watiIsConfigured } from "@/lib/wati";

export async function GET(request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  const db = await getDb();
  const filtered = eventId ? db.messages.filter((m) => m.eventId === eventId) : db.messages;
  const messages = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return NextResponse.json({ messages, watiConfigured: watiIsConfigured() });
}
