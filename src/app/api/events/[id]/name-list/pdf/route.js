import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { canAccessEvent } from "@/lib/coupleAuth";
import { isAdminAuthed } from "@/lib/auth";
import { getSenderSession } from "@/lib/senderAuth";
import { getScannerSession } from "@/lib/scannerAuth";
import { resolveGuard } from "@/lib/security";
import { bothLists } from "@/lib/nameList";
import { nameListSheetHtml } from "@/lib/nameListSheet";
import { formatEventDateArabic } from "@/lib/date";

// The door list as a sheet: a PDF to keep or share, and ?print=1 for the same
// page straight to a printer.
//
// Printing is the HTML itself rather than a second render — the browser
// already in front of the person pressing the button lays it out the same
// way, and it saves an entire Chromium launch for something they are about to
// put on a clipboard anyway.
export const dynamic = "force-dynamic";
// A browser launch, same as the cards.
export const maxDuration = 120;

async function mayRead(eventId, guardKey) {
  if (await isAdminAuthed()) return true;
  if (await canAccessEvent(eventId)) return true;
  const sender = await getSenderSession();
  if (sender?.eventId === eventId) return true;
  const scanner = await getScannerSession();
  if (scanner?.eventId === eventId) return true;
  if (guardKey) {
    const guard = resolveGuard(await getDb(), guardKey);
    if (guard?.event?.id === eventId) return true;
  }
  return false;
}

export async function GET(request, { params }) {
  const { id: eventId } = await params;
  const { searchParams } = new URL(request.url);
  if (!(await mayRead(eventId, searchParams.get("key")))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const db = await getDb();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });

  const lists = bothLists(event);
  const html = nameListSheetHtml({
    coupleNames: event.coupleNames,
    eventDate: event.eventDate ? formatEventDateArabic(event.eventDate) : "",
    venue: event.venueName || event.venueAddress || "",
    groom: lists.groom,
    bride: lists.bride,
    autoPrint: searchParams.get("print") === "1",
  });

  if (searchParams.get("print") === "1") {
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const { renderHtmlToPdf } = await import("@/lib/cards/render");
  const pdf = await renderHtmlToPdf(html);
  const name = `da3wa-door-list-${eventId.slice(0, 8)}.pdf`;
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
