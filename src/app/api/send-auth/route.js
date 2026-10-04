import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getSenderSession,
  createSenderSession,
  clearSenderSession,
  SIDES,
} from "@/lib/senderAuth";

// Login for the sending app (/send). The groom and the bride each have their
// own username and password, created by the platform admin from the wedding's
// dashboard; the side they log in as decides which guests they see.
function describe(event, side) {
  return {
    event: { id: event.id, coupleNames: event.coupleNames },
    side,
  };
}

export async function GET() {
  const session = await getSenderSession();
  if (!session) return NextResponse.json({ authed: false });
  return NextResponse.json({ authed: true, ...describe(session.event, session.side) });
}

export async function POST(request) {
  const { username, password } = await request.json().catch(() => ({}));
  const cleanUsername = String(username || "").trim().toLowerCase();
  if (!cleanUsername || !password) {
    return NextResponse.json({ error: "اكتب اسم المستخدم وكلمة المرور" }, { status: 400 });
  }

  const db = await getDb();
  for (const event of db.events) {
    if (event.status === "deleted") continue;
    for (const side of SIDES) {
      const account = event.senders?.[side];
      if (account?.username === cleanUsername && account.password === password) {
        await createSenderSession(event.id, side, account.password);
        return NextResponse.json({ ok: true, ...describe(event, side) });
      }
    }
  }
  return NextResponse.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
}

export async function DELETE() {
  await clearSenderSession();
  return NextResponse.json({ ok: true });
}
