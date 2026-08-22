import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { sendSessionMessage } from "@/lib/wati";

// Admin-only test endpoint: sends a free-form WhatsApp text message via
// Wati's "session message" path, which does NOT require an approved Meta
// template — unlike sendTemplateMessage, which every other route in this
// app uses. The trade-off: WhatsApp only allows a session message within a
// 24-hour window that opens after the RECIPIENT messages the connected
// business number first. If that window is closed, Wati will reject the
// send regardless of how correct our code/credentials are — this is a
// WhatsApp/Meta policy limit, not something this endpoint can bypass.
export async function POST(request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { phone, message } = body;

  if (!phone || !message) {
    return NextResponse.json({ error: "يجب إدخال الرقم ونص الرسالة" }, { status: 400 });
  }

  const result = await sendSessionMessage({ phone, text: message });
  return NextResponse.json(result);
}
