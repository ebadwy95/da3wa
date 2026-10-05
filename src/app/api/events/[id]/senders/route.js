import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { SIDES } from "@/lib/senderAuth";
import { siteOrigin } from "@/lib/seo";

// Admin: the groom's and the bride's logins for the sending app. Shown in
// full to the admin, who hands them to the couple; resetting a password logs
// that side out.
function present(db, event) {
  const counts = { groom: 0, bride: 0, none: 0 };
  for (const g of db.guests) {
    if (g.eventId === event.id) counts[g.side || "none"] += 1;
  }
  return {
    link: `${siteOrigin()}/send`,
    senders: {
      groom: event.senders?.groom || null,
      bride: event.senders?.bride || null,
    },
    counts,
  };
}

async function guard(params) {
  if (!(await isAdminAuthed())) return { response: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) };
  const { id } = await params;
  return { id };
}

export async function GET(request, { params }) {
  const { id, response } = await guard(params);
  if (response) return response;
  const db = await getDb();
  const event = db.events.find((e) => e.id === id);
  if (!event) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  return NextResponse.json(present(db, event));
}

// { side } creates that side's login, or gives it a new password.
export async function POST(request, { params }) {
  const { id, response } = await guard(params);
  if (response) return response;
  const { side } = await request.json().catch(() => ({}));
  if (!SIDES.includes(side)) return NextResponse.json({ error: "الطرف غير معروف" }, { status: 400 });

  const ok = await withDb((db) => {
    const event = db.events.find((e) => e.id === id);
    if (!event) return false;
    event.senders = event.senders || {};
    const existing = event.senders[side];
    event.senders[side] = {
      username: existing?.username || `${side}${crypto.randomBytes(3).toString("hex")}`,
      password: String(crypto.randomInt(100000, 1000000)),
    };
    return true;
  });
  if (!ok) return NextResponse.json({ error: "الزفاف غير موجود" }, { status: 404 });
  const db = await getDb();
  return NextResponse.json(present(db, db.events.find((e) => e.id === id)));
}
