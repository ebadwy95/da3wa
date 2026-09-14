// Builds public/da3wa-guests-template.xlsx, the sheet couples download to fill
// in their guest list.
//
//   node tools/make-guests-template.mjs
//
// An Excel file rather than only the CSV, because of the phone column. Excel
// treats a leading + as a formula and drops it, and shows a twelve-digit
// number as 9.66551E+11 — saved from that view, the number's last digits are
// lost for good. Here the phone column is formatted as text before anyone
// types in it, so what is typed is what is kept. The upload also accepts the
// number without a +, for sheets made some other way.
import * as XLSX from "xlsx";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "public", "da3wa-guests-template.xlsx");

// Must match TEMPLATE_HEADERS in src/app/api/events/[id]/guests/bulk/route.js.
const HEADERS = [
  "الاسم",
  "رقم الواتساب (مع كود الدولة)",
  "إجمالي عدد الحضور (شامل الضيف نفسه)",
  "لغة الدعوة (AR أو ENG)",
];

const EXAMPLES = [
  ["أحمد محمد", "96550012345", 3, "AR"],
  ["سارة علي", "966550678901", 1, "AR"],
  ["John Smith", "447700900123", 2, "ENG"],
];

const ROWS = 500; // rows with the phone column already set to text
const TEXT = "@";

const ws = {};
const put = (r, c, cell) => {
  ws[XLSX.utils.encode_cell({ r, c })] = cell;
};

HEADERS.forEach((h, c) => put(0, c, { t: "s", v: h }));
for (let r = 1; r <= ROWS; r++) {
  const ex = EXAMPLES[r - 1];
  if (ex) {
    put(r, 0, { t: "s", v: ex[0] });
    put(r, 1, { t: "s", v: ex[1], z: TEXT });
    put(r, 2, { t: "n", v: ex[2] });
    put(r, 3, { t: "s", v: ex[3] });
  } else {
    // An empty text-formatted cell: whatever is typed into it stays text.
    put(r, 1, { t: "s", v: "", z: TEXT });
  }
}

ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ROWS, c: HEADERS.length - 1 } });
ws["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 32 }, { wch: 22 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "الضيوف");
// Right-to-left, as the couple reads it.
wb.Workbook = { Views: [{ RTL: true }] };

XLSX.writeFile(wb, OUT, { bookType: "xlsx" });
console.log(`written ${OUT}`);
