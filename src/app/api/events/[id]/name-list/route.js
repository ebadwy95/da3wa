import { NextResponse } from "next/server";
import { getDb, withDb } from "@/lib/db";
import { canAccessEvent } from "@/lib/coupleAuth";
import { isAdminAuthed } from "@/lib/auth";
import { getSenderSession } from "@/lib/senderAuth";
import { getScannerSession } from "@/lib/scannerAuth";
import { resolveGuard } from "@/lib/security";
import { bothLists, listLimit, normaliseList, putList, LIST_SIDES } from "@/lib/nameList";

// The door list, read by four different people and written by three.
//
// Reading is wide on purpose: the whole point of the list is that whoever is
// on the door can see it. The scanner's own session counts, alongside the
// admin and the couple — they are all looking at the same sheet of paper.
//
// Writing is narrower: the platform admin and the couple can write either
// side, and each of the couple's own sending logins can write only their own.
async function who(eventId, guardKey) {
  if (await isAdminAuthed()) return { read: true, write: LIST_SIDES };
  if (await canAccessEvent(eventId)) return { read: true, write: LIST_SIDES };
  const sender = await getSenderSession();
  if (sender?.eventId === eventId) return { read: true, write: [sender.side] };
  const scanner = await getScannerSession();
  if (scanner?.eventId === eventId) return { read: true, write: [] };
  // The security contact's app has no cookie — its key IS the credential,
  // and it is already what lets them hear the alarm for this wedding.
  if (guardKey) {
    const guard = resolveGuard(await getDb(), guardKey);
    if (guard?.event?.id === eventId) return { read: true, write: [] };
  }
  return { read: false, write: [] };
}

export async function GET(request, { params }) {
  const { id: eventId } = await params;
  const access = await who(eventId, new URL(request.url).searchParams.get("key"));
  if (!access.read) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });

  return NextResponse.json({
    ...bothLists(event),
    coupleNames: event.coupleNames,
    groomName: event.groomName || null,
    brideName: event.brideName || null,
    canWrite: access.write,
  });
}

export async function PUT(request, { params }) {
  const { id: eventId } = await params;
  const access = await who(eventId);

  const body = await request.json().catch(() => ({}));
  const side = body?.side;
  if (!LIST_SIDES.includes(side)) {
    return NextResponse.json({ error: "الطرف لازم يكون العريس أو العروس" }, { status: 400 });
  }
  if (!access.write.includes(side)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });

  const { entries, error } = normaliseList(body?.entries, listLimit(event));
  if (error) return NextResponse.json({ error }, { status: 400 });

  const saved = await withDb((fresh) => {
    const e = fresh.events.find((x) => x.id === eventId);
    if (!e) return { missing: true };
    putList(e, side, entries);
    return bothLists(e);
  });
  if (saved.missing) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  return NextResponse.json({ ...saved, canWrite: access.write });
}
