import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb, withDb } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { generateScannerCode, generateCoupleUsername, generateCouplePassword } from "@/lib/token";
import { computeDisplayStatus } from "@/lib/date";
import { splitCoupleNames, joinCoupleNames } from "@/lib/couple";

function withCounts(event, guests) {
  const eventGuests = guests.filter((g) => g.eventId === event.id);
  return {
    ...event,
    guestCount: eventGuests.length,
    remaining: Math.max(0, event.packageLimit - eventGuests.length),
    displayStatus: computeDisplayStatus(event),
  };
}

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  // Backfill: events created before the per-event scanner-code / couple-login
  // / multi-scanner / archive features existed won't have them yet —
  // generate and persist on first read so every event (old or new) always
  // has everything it needs to show/share.
  const needsBackfill = (await getDb()).events.some(
    (e) =>
      !e.coupleUsername ||
      !e.couplePassword ||
      !e.scanners ||
      !e.status ||
      (!e.groomName && !e.brideName)
  );
  const db = needsBackfill
    ? await withDb((db) => {
        db.events.forEach((e) => {
          // Events created before the names were split only have the joined
          // string. Split it on a best effort basis so the admin sees both
          // halves in the edit form and can correct them — the WhatsApp send
          // paths refuse to run on an empty groom/bride, so a failed split
          // surfaces as a blocked send, never as a wrong message.
          if (!e.groomName && !e.brideName) {
            const parts = splitCoupleNames(e.coupleNames);
            e.groomName = parts.groomName;
            e.brideName = parts.brideName;
          }
          if (!e.coupleUsername) e.coupleUsername = generateCoupleUsername();
          if (!e.couplePassword) {
            e.couplePassword = generateCouplePassword();
            e.mustChangePassword = true;
          }
          if (!e.status) e.status = "active";
          if (!e.scanners || e.scanners.length === 0) {
            // Migrate the old single scannerCode (unnamed) into the new
            // multi-scanner list — the admin can name it from the dashboard.
            e.scanners = [
              { id: randomUUID(), code: e.scannerCode || generateScannerCode(), name: "" },
            ];
          }
          delete e.scannerCode;
        });
        return db;
      })
    : await getDb();
  const events = db.events
    .map((e) => withCounts(e, db.guests))
    .filter((e) => e.displayStatus !== "hidden")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return NextResponse.json({ events });
}

export async function POST(request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const {
    groomPhone,
    groomName,
    brideName,
    coupleNames,
    eventDate,
    eventTime,
    venueName,
    inviteVideoUrl,
    invitePosterUrl,
    inviteAudioUrl,
    inviteTheme,
    venueAddress,
    venueMapUrl,
    welcomeMessage,
    packageLimit,
  } = body;

  // Required: every event MUST be tied to the groom/couple's phone number —
  // it's the only identifier we have for a wedding before real per-couple
  // accounts exist.
  if (!groomPhone) {
    return NextResponse.json({ error: "رقم العريس مطلوب لإنشاء أي زفاف جديد" }, { status: 400 });
  }
  const phone = normalizePhone(groomPhone);
  if (!phone.valid) {
    return NextResponse.json({ error: `رقم العريس غير صالح: ${phone.error}` }, { status: 400 });
  }
  // The two names are stored separately because the WhatsApp templates take
  // {{groom}} and {{bride}} as separate variables. A caller that only sends
  // the old joined coupleNames still works: we split it here rather than
  // rejecting, and the admin sees both halves in the edit form.
  const fallback = splitCoupleNames(coupleNames);
  const resolvedGroom = String(groomName || fallback.groomName || "").trim();
  const resolvedBride = String(brideName || fallback.brideName || "").trim();
  const resolvedCoupleNames =
    joinCoupleNames(resolvedGroom, resolvedBride) || String(coupleNames || "").trim();

  if (!resolvedCoupleNames) {
    return NextResponse.json({ error: "اسم العريس واسم العروسة مطلوبان" }, { status: 400 });
  }

  const event = {
    id: randomUUID(),
    groomPhone: phone.digits,
    groomPhoneDisplay: phone.e164,
    groomName: resolvedGroom,
    brideName: resolvedBride,
    // Derived from the two names above — what guests read on the invitation,
    // kept identical to what the templates produce when they join them.
    coupleNames: resolvedCoupleNames,
    eventDate: eventDate || "",
    // "HH:MM". Needed by the reminder template's {{time}} variable.
    eventTime: eventTime || "",

    // The couple's own film and music, played behind a tap-to-open cover on
    // the invitation. Stored as URLs rather than uploads — the film is made by
    // whoever designs it and already lives somewhere, so the platform stays
    // out of the business of hosting large media.
    inviteVideoUrl: inviteVideoUrl || "",
    invitePosterUrl: invitePosterUrl || "",
    inviteAudioUrl: inviteAudioUrl || "",
    // "light" (cream and gold) or "dark". The invitation only.
    inviteTheme: inviteTheme === "dark" ? "dark" : "light",
    venueName: venueName || "",
    venueAddress: venueAddress || "",
    venueMapUrl: venueMapUrl || "",
    welcomeMessage:
      welcomeMessage ||
      "يتشرف بدعوتكم لحضور حفل زفافهم، ونتطلع لمشاركتكم هذه الليلة السعيدة.",
    // Invite-count package the couple paid for. Set by the platform admin
    // based on what was agreed with the couple — not self-serve yet.
    packageLimit: Math.max(1, parseInt(packageLimit, 10) || 100),
    // Lets THIS event's door staff log into /scan without the platform
    // admin password, and without being able to check in another event's
    // guests — see src/app/api/scan-auth/route.js. Several people can scan
    // at once at a big wedding, each with their own named code, added later
    // from the dashboard via POST .../scanners.
    scanners: [{ id: randomUUID(), code: generateScannerCode(), name: "" }],
    // Lifecycle: "active" -> auto-archived (display-only, computed from the
    // date, see src/lib/date.js) -> "deleted" (soft, recallable for 30 days)
    // -> permanently hidden from every listing (but never actually erased).
    status: "active",
    deletedAt: null,
    // Lets the couple themselves log into /couple and manage ONLY their own
    // event (add guests, send invites, see stats) without the platform
    // admin password and without seeing any other couple's event. Stored in
    // plain text on the event record — same simplicity level as
    // ADMIN_PASSWORD elsewhere in this app; fine for this stage, worth
    // revisiting if/when this becomes a bigger multi-tenant product.
    coupleUsername: generateCoupleUsername(),
    couplePassword: generateCouplePassword(),
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };

  await withDb((db) => {
    db.events.push(event);
  });

  return NextResponse.json({ event: withCounts(event, []) }, { status: 201 });
}
