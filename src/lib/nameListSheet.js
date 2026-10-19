// The door list as one sheet of paper.
//
// Two columns on one page, the groom's names on the right and the bride's on
// the left, because the alternative is two sheets and the person on the door
// has one pair of hands. Numbered rows so two people can talk about "number
// fourteen" down a radio, and a tick box beside each name because this page
// ends up on a clipboard whatever we intend.
//
// Deliberately plain: this is not an invitation, it is a working document,
// and it has to stay readable printed in black and white under a marquee.

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function column(title, entries) {
  const rows = entries.length
    ? entries
        .map(
          (e, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td class="b"></td>
        <td class="nm">${esc(e.name)}</td>
        <td class="ph">${e.phone ? esc(e.phone) : ""}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">لا توجد أسماء</td></tr>`;

  return `
  <section class="col">
    <h2>${esc(title)}</h2>
    <table>
      <thead>
        <tr><th class="n">#</th><th class="b"></th><th class="nm">الاسم</th><th class="ph">الجوال</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export function nameListSheetHtml({ coupleNames, eventDate, venue, groom, bride, autoPrint = false }) {
  const printed = new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>قائمة الدخول بالاسم — ${esc(coupleNames || "")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Amiri",serif;color:#1b1813;font-size:12pt;line-height:1.5}
  header{text-align:center;border-bottom:2px solid #1b1813;padding-bottom:8px;margin-bottom:14px}
  header h1{font-size:19pt;font-weight:700}
  header .sub{font-size:11pt;color:#4a443c;margin-top:3px}
  header .note{font-size:10pt;color:#4a443c;margin-top:7px}
  .sheet{display:flex;gap:0}
  /* The rule between the columns is the whole layout — keep it a background
     so it survives a printer with backgrounds switched off badly. */
  .col{flex:1;padding:0 10px}
  .col:first-child{border-left:1px solid #b9b2a6}
  .col h2{font-size:13pt;font-weight:700;text-align:center;margin-bottom:8px;
    background:#efe9dd;padding:4px;border-radius:3px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:right;padding:4px 3px;border-bottom:1px solid #ddd7cb;vertical-align:middle}
  th{font-size:9.5pt;color:#4a443c;font-weight:400}
  td.n,th.n{width:22px;text-align:center;color:#6b6358;font-size:10pt}
  td.b,th.b{width:16px}
  td.b{border:0}
  td.b::before{content:"";display:inline-block;width:11px;height:11px;border:1px solid #6b6358;border-radius:2px}
  td.nm{font-size:12.5pt}
  td.ph{font-size:10pt;color:#4a443c;direction:ltr;text-align:left;white-space:nowrap}
  td.empty{text-align:center;color:#8a8278;padding:14px 0;font-size:10.5pt}
  footer{margin-top:16px;border-top:1px solid #b9b2a6;padding-top:6px;
    display:flex;justify-content:space-between;font-size:9pt;color:#6b6358}
</style>
</head>
<body>
  <header>
    <h1>قائمة الدخول بالاسم</h1>
    <div class="sub">${esc(coupleNames || "")}${eventDate ? ` — ${esc(eventDate)}` : ""}${venue ? ` — ${esc(venue)}` : ""}</div>
    <div class="note">هؤلاء يدخلون بأسمائهم بدون رمز QR. تأكّد من الاسم، وضع علامة في المربع عند الدخول.</div>
  </header>
  <div class="sheet">
    ${column("ضيوف العريس", groom)}
    ${column("ضيوف العروس", bride)}
  </div>
  <footer>
    <span>عدد الأسماء: ${groom.length + bride.length}</span>
    <span>طُبعت: ${esc(printed)}</span>
    <span>da3wa.digital</span>
  </footer>
  ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>' : ""}
</body>
</html>`;
}
