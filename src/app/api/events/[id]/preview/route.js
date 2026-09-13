import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { canAccessEvent } from "@/lib/coupleAuth";
import { normaliseInviteLanguage } from "@/lib/inviteCopy";
import { buildInviteEvent } from "@/lib/inviteEvent";

// The invitation as a guest will see it, for the couple or the admin to look
// at from the dashboard — in Arabic or English.
//
// A made-up guest rather than a real one. Opening a real guest's link to
// check the design would put that guest's RSVP buttons in the admin's hands,
// and one stray tap confirms or declines for someone who hasn't answered.
// The event half is built by the same function the guest endpoint uses, so
// the preview is the real card.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!(await canAccessEvent(id))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const db = await getDb();
  const fullEvent = db.events.find((e) => e.id === id);
  if (!fullEvent) {
    return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  }

  const language = normaliseInviteLanguage(new URL(request.url).searchParams.get("lang")) || "ar";

  const guest = {
    id: "preview",
    eventId: id,
    name: language === "en" ? "Guest Name" : "اسم الضيف",
    language,
    // Two companions, so the preview shows the party-size picker a real
    // guest with companions would see.
    maxCompanions: 2,
    status: "pending",
    confirmedCompanions: null,
    wishMessage: "",
    qrDataUrl: null,
  };

  return NextResponse.json({ guest, event: buildInviteEvent(fullEvent, language), language, preview: true });
}
