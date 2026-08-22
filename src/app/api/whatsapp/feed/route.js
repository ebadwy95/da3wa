import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";
import { watiIsConfigured } from "@/lib/wati";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  const authed = eventId ? await canAccessEvent(eventId) : await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const db = await getDb();
  const filtered = eventId ? db.messages.filter((m) => m.eventId === eventId) : db.messages;
  const messages = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return NextResponse.json({ messages, watiConfigured: watiIsConfigured() });
}
