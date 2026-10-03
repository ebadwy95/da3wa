import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { canAccessEvent } from "@/lib/coupleAuth";
import { messagingIsConfigured } from "@/lib/messaging";
import { syncEventDeliveries } from "@/lib/delivery";

// What the guest did proves more than any receipt. Wati's Growth plan sends no
// delivery webhooks, so an invitation stays at "sent" forever — even for a
// guest who has since opened it and answered. Someone who opened the link got
// the message and read it; the feed says so instead of waiting on a report
// that is never coming.
function withObservedDelivery(message, guestsById) {
  if (!["sent", "delivered", "read"].includes(message.status) || message.type !== "invite_sent") {
    return message;
  }
  const guest = guestsById.get(message.guestId);
  if (!guest) return message;
  const sentAt = new Date(message.createdAt).getTime();
  const acted = [guest.openedAt, guest.lastOpenedAt, guest.respondedAt]
    .filter(Boolean)
    .some((t) => new Date(t).getTime() >= sentAt);
  if (!acted) return message;
  return {
    ...message,
    status: guest.status === "confirmed" || guest.status === "declined" ? "answered" : "opened",
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  const authed = eventId ? await canAccessEvent(eventId) : await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // Learn what WhatsApp actually did with recent sends before showing them —
  // without this a refused message reads "sent" forever (see syncEventDeliveries).
  if (eventId) {
    await syncEventDeliveries(eventId).catch((err) =>
      console.warn("[feed] delivery sync failed:", err.message)
    );
  }

  const db = await getDb();
  const guestsById = new Map(db.guests.map((g) => [g.id, g]));
  const filtered = eventId ? db.messages.filter((m) => m.eventId === eventId) : db.messages;
  const messages = [...filtered]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((m) => withObservedDelivery(m, guestsById));
  // Key kept as watiConfigured because both dashboards read it; it now means
  // "a WhatsApp provider is configured", whichever one that is.
  return NextResponse.json({ messages, watiConfigured: messagingIsConfigured() });
}

// Clears a wedding's message log — for wiping out test sends before the real
// ones start. Admin only: the log is the record of what the platform sent, and
// a couple should not be able to erase it. Nothing else reads these entries
// back (guest status, invite and reminder stamps live on the guest), so this
// changes what the feed shows and nothing about who has been messaged.
export async function DELETE(request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "حدّد الزفاف" }, { status: 400 });
  }

  const removed = await withDb((db) => {
    const before = db.messages.length;
    db.messages = db.messages.filter((m) => m.eventId !== eventId);
    return before - db.messages.length;
  });
  return NextResponse.json({ ok: true, removed });
}
