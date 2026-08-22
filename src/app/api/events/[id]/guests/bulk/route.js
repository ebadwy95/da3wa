import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { withDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { canAccessEvent } from "@/lib/coupleAuth";

// The ONLY accepted column header row, in this exact order. We deliberately
// do NOT try to be clever about reordered/renamed columns — a strict
// template avoids silently misreading someone's ad-hoc sheet (e.g. treating
// a "phone" column as "companions" because the columns got swapped).
export const TEMPLATE_HEADERS = ["الاسم", "رقم الواتساب (مع كود الدولة)", "إجمالي عدد الحضور (شامل الضيف نفسه)"];

function normalizeHeaderCell(v) {
  return String(v ?? "").trim();
}

export async function POST(request, { params }) {
  const { id: eventId } = await params;
  if (!(await canAccessEvent(eventId))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "يجب رفع ملف (Excel أو CSV)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "تعذّر قراءة الملف — يجب أن يكون ملف Excel أو CSV صحيحًا" }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
  }

  const headerRow = rows[0].map(normalizeHeaderCell);
  const headerMatches =
    headerRow.length >= TEMPLATE_HEADERS.length &&
    TEMPLATE_HEADERS.every((h, i) => headerRow[i] === h);

  if (!headerMatches) {
    return NextResponse.json(
      {
        error:
          "شكل الملف غير مطابق للنموذج المطلوب — يُرجى تحميل النموذج وإرسال نفس الأعمدة بنفس الترتيب دون تعديل",
        expectedHeaders: TEMPLATE_HEADERS,
        receivedHeaders: headerRow,
      },
      { status: 422 }
    );
  }

  const dataRows = rows.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ""));

  const errors = [];
  const candidates = [];

  dataRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexing
    const [rawName, rawPhone, rawTotalGuests] = row;
    const name = String(rawName || "").trim();
    if (!name) {
      errors.push({ row: rowNumber, reason: "الاسم فارغ" });
      return;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone.valid) {
      errors.push({ row: rowNumber, reason: `رقم الضيف "${name}": ${phone.error}` });
      return;
    }
    // The sheet's number is the TOTAL party size including the guest
    // themself (e.g. 3 = هو + مرافقين اتنين) — stored internally as
    // companions beyond the guest, same as the single-add form.
    const maxTotalGuests = Math.max(1, parseInt(rawTotalGuests, 10) || 1);
    const maxCompanions = maxTotalGuests - 1;
    candidates.push({ name, phone, maxCompanions, rowNumber });
  });

  const result = await withDb((db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return { error: "الزفاف غير موجود", status: 404 };

    const currentCount = db.guests.filter((g) => g.eventId === eventId).length;
    const remaining = Math.max(0, event.packageLimit - currentCount);

    const toAdd = candidates.slice(0, remaining);
    const skippedForLimit = candidates.slice(remaining);

    const added = toAdd.map((c) => {
      const guest = {
        id: randomUUID(),
        eventId,
        name: c.name,
        phone: c.phone.digits,
        phoneDisplay: c.phone.e164,
        maxCompanions: c.maxCompanions,
        status: "pending",
        confirmedCompanions: null,
        checkedIn: false,
        checkedInCount: 0,
        checkedInAt: null,
        lastCheckedInAt: null,
        qrDataUrl: null,
        invitedAt: null,
        createdAt: new Date().toISOString(),
      };
      db.guests.push(guest);
      return guest;
    });

    return {
      added: added.length,
      skippedForLimit: skippedForLimit.map((c) => ({ row: c.rowNumber, reason: "تجاوز الحد الأقصى المتاح للباقة" })),
      packageLimit: event.packageLimit,
      guestCountAfter: currentCount + added.length,
    };
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({
    added: result.added,
    totalRowsInFile: dataRows.length,
    errors: [...errors, ...result.skippedForLimit],
    packageLimit: result.packageLimit,
    guestCountAfter: result.guestCountAfter,
  });
}
