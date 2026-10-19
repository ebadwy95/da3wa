// A business card, in the same hand as everything else Da3wa makes.
//
// 85×55mm at 300dpi with a 3mm bleed, which is what a printer in Kuwait will
// ask for without having to be asked. The face carries the mark, the name and
// one QR; the back is the pitch in one sentence and the contacts.
//
// The QR is the whole point of the card. A card with a website on it gets put
// in a pocket; a card whose code opens a live invitation with the scanner's
// own name on it gets shown to the person standing next to them. Which code
// it carries is a choice at print time — the live demo or the site — because
// the two conversations are different and he knows which one he is in.

const MM = 300 / 25.4; // dots per mm at 300dpi
export const CARD_W = Math.round(91 * MM); // 85mm + 3mm bleed each side
export const CARD_H = Math.round(61 * MM);
const SAFE = Math.round(6 * MM); // bleed + a printer's margin for error

const FONTS =
  "https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@300;400;600;700&family=Cormorant+Garamond:wght@300;400;600&display=swap";

const STAR_TILE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Cpath fill='none' stroke='%23b08d57' stroke-width='0.7' stroke-opacity='0.085' d='M17 3.5 L20.4 13.6 L30.5 17 L20.4 20.4 L17 30.5 L13.6 20.4 L3.5 17 L13.6 13.6 Z'/%3E%3C/svg%3E";

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MARK = `<svg class="mark" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.6 14.1 9.9 22.4 12 14.1 14.1 12 22.4 9.9 14.1 1.6 12 9.9 9.9Z"/></svg>`;

const COPY = {
  ar: {
    dir: "rtl",
    lang: "ar",
    brand: "دعوة",
    tagline: "دعوات إلكترونية للمناسبات",
    role: "مؤسس",
    pitchTitle: "من قائمة أسماء إلى ليلة منظّمة",
    pitch:
      "دعوة شخصية لكل ضيف على واتساب، تأكيد حضور بعدد المرافقين، وبطاقة دخول تُمسح على الباب — وعدد نهائي تبني عليه القاعة والبوفيه.",
    scanLabel: "امسح الرمز وجرّبها بنفسك",
  },
  en: {
    dir: "ltr",
    lang: "en",
    brand: "Da3wa",
    tagline: "Digital invitations for weddings & events",
    role: "Founder",
    pitchTitle: "From a list of names to an organised night",
    pitch:
      "A personal WhatsApp invitation for every guest, an RSVP with the number coming, and an entry pass scanned at the door — and one headcount the hall and the caterer can plan from.",
    scanLabel: "Scan to try it yourself",
  },
};

/**
 * @param side  "front" | "back"
 * @param lang  "ar" | "en"
 * @param name  the person's name, already carrying any honorific
 * @param qr    data URL
 */
export function businessCardHtml({ side = "front", lang = "ar", name, phone, email, site, qr, scanNote }) {
  const t = COPY[lang] || COPY.ar;
  const en = lang === "en";

  // Laid out as a column that ends in the QR row rather than floating the
  // code in a corner: the English name is long and was running underneath it.
  const face = `
  <div class="side front stack">
    <div class="rule-top"></div>
    <div class="top">
      <div class="brand-row centre">
        ${MARK}
        <div class="brand">${esc(t.brand)}</div>
      </div>
      <div class="tag">${esc(t.tagline)}</div>
    </div>
    <div class="person">
      <div class="name">${esc(name)}</div>
      <div class="role">${esc(t.role)}</div>
    </div>
    <div class="qr-row">
      <img class="qr" src="${esc(qr)}" alt="">
      <div class="scan">${esc(scanNote || t.scanLabel)}</div>
    </div>
  </div>`;

  const back = `
  <div class="side back">
    <div class="brand-row centre">
      ${MARK}
      <div class="brand">${esc(t.brand)}</div>
    </div>
    <div class="pitch-title">${esc(t.pitchTitle)}</div>
    <div class="pitch">${esc(t.pitch)}</div>
    <div class="divider wide"></div>
    <div class="contacts">
      <div class="c ltr">${esc(phone)}</div>
      <div class="c ltr">${esc(email)}</div>
      <div class="c ltr">${esc(site)}</div>
    </div>
  </div>`;

  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#efe7d8}
  :root{--paper:#faf6ef;--ink:#2c2620;--ink-2:#5c534a;--gold:#b08d57;--gold-d:#816539;--gold-l:#d4b77e}
  .side{position:relative;width:${CARD_W}px;height:${CARD_H}px;background:var(--paper);overflow:hidden;
   font-family:"Cairo",sans-serif;color:var(--ink);
   display:flex;flex-direction:column;align-items:center;justify-content:center;
   padding:${SAFE}px ${Math.round(SAFE * 1.4)}px}
  .side::before{content:"";position:absolute;inset:0;background-image:url("${STAR_TILE}")}
  .side::after{content:"";position:absolute;inset:0;
   background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(255,250,240,.8),transparent 70%)}
  .side > *{position:relative;z-index:2}

  /* A band of foil across the top edge — the one printed flourish, and the
     thing that makes the card feel like it came from the same place as the
     invitation. */
  .rule-top{position:absolute;top:0;left:0;right:0;height:${Math.round(2.6 * MM)}px;z-index:3;
   background:linear-gradient(90deg,#8a6a33,#b08d57 22%,#f0dcae 46%,#fff6e2 52%,#f0dcae 58%,#b08d57 80%,#8a6a33)}

  .brand-row{display:flex;align-items:center;gap:${Math.round(1.6 * MM)}px}
  .brand-row.centre{justify-content:center}
  .mark{width:${Math.round(6 * MM)}px;height:${Math.round(6 * MM)}px;color:var(--gold)}
  .brand{font-family:"Aref Ruqaa",serif;font-size:${Math.round(8.4 * MM)}px;line-height:1.1;
   background:linear-gradient(104deg,#8a6a33,#b08d57 26%,#f0dcae 46%,#fff6e2 52%,#f0dcae 58%,#b08d57 76%,#8a6a33);
   -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .tag{margin-top:${Math.round(1.2 * MM)}px;font-size:${Math.round(2.5 * MM)}px;color:var(--ink-2);
   letter-spacing:.02em;text-align:center}

  .divider{margin:${Math.round(3 * MM)}px 0;width:${Math.round(26 * MM)}px;height:1px;
   background:linear-gradient(90deg,transparent,var(--gold-l),transparent)}
  .divider.wide{width:${Math.round(46 * MM)}px}

  .person{text-align:center;max-width:100%}
  .name{font-size:${Math.round((en ? 4.3 : 5) * MM)}px;font-weight:700;letter-spacing:-.01em}
  .role{margin-top:${Math.round(0.8 * MM)}px;font-size:${Math.round(2.6 * MM)}px;color:var(--gold-d);
   letter-spacing:.18em;text-transform:uppercase}

  /* The face is a column with three stops, so nothing can land on anything
     else however long a name turns out to be. */
  .side.stack{justify-content:space-between}
  .side.stack .top{display:flex;flex-direction:column;align-items:center;margin-top:${Math.round(2 * MM)}px}
  .qr-row{display:flex;align-items:center;gap:${Math.round(2.4 * MM)}px;align-self:stretch}
  .qr{width:${Math.round(16 * MM)}px;height:${Math.round(16 * MM)}px;display:block;flex-shrink:0;
   border:1px solid var(--gold-l);border-radius:${Math.round(1.6 * MM)}px;background:#fff;padding:${Math.round(0.8 * MM)}px}
  .scan{font-size:${Math.round(2.1 * MM)}px;color:var(--ink-2);line-height:1.4;text-align:${en ? "left" : "right"}}

  .pitch-title{margin-top:${Math.round(3 * MM)}px;font-size:${Math.round(3.4 * MM)}px;font-weight:600;
   text-align:center;color:var(--gold-d)}
  .pitch{margin-top:${Math.round(1.6 * MM)}px;font-size:${Math.round(2.5 * MM)}px;line-height:1.75;
   color:var(--ink-2);text-align:center;max-width:${Math.round(62 * MM)}px}
  .contacts{display:flex;flex-direction:column;gap:${Math.round(0.9 * MM)}px;align-items:center}
  .c{font-size:${Math.round(2.7 * MM)}px;color:var(--ink)}
  .ltr{direction:ltr}
  body.en .brand{font-family:"Cormorant Garamond",serif;font-weight:600}
</style>
</head>
<body class="${en ? "en" : ""}">
${side === "back" ? back : face}
</body>
</html>`;
}
