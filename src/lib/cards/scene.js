// The two cards a guest receives on WhatsApp, as HTML a browser can render.
//
//   - "qr"     the entry pass: their own code, their name, the night's details
//   - "thanks" the note that goes out the day after the wedding
//
// Both are built from the invitation's own materials — the cream paper, the
// eight-point tile, Aref Ruqaa for the names, Amiri for the text — so a guest
// who kept the invitation sees these as parts of the same thing rather than as
// generic WhatsApp attachments.
//
// This is a string of HTML rather than a React component on purpose: it is
// rendered by a headless browser (src/lib/cards/render.js), never by Next, and
// the same module is what tools/qrcard and tools/thanks render from, so the
// design cannot drift between what we preview locally and what guests get.
//
// Portrait 1080×1350: WhatsApp shows a portrait image large in the chat and
// crops a landscape one.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const FONTS =
  "https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Amiri:wght@400;700&family=Great+Vibes&family=Cormorant+Garamond:wght@300;400;600&display=swap";

// The tile the invitation itself is laid on, at the opacity it reads at when
// the card is looked at on a phone rather than a desktop.
const STAR_TILE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52' viewBox='0 0 44 44'%3E%3Cpath fill='none' stroke='%23c8a06a' stroke-width='0.7' stroke-opacity='0.13' d='M22 4.5 L26.4 17.6 L39.5 22 L26.4 26.4 L22 39.5 L17.6 26.4 L4.5 22 L17.6 17.6 Z'/%3E%3C/svg%3E";

/** Guest names and venue names are typed by people; they end up inside HTML. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A two-line block where each line is escaped but the break is real. */
function lines(list) {
  return list.filter(Boolean).map(esc).join("<br>");
}

const CORNERS = `
  <svg class="corner c1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M23 1h-8M23 1v8M23 1 15 9"/><path d="M19 5.5 20 8.6l3.1 1-3.1 1-1 3.1-1-3.1-3.1-1 3.1-1Z" fill="currentColor" stroke="none" opacity=".8"/></svg>
  <svg class="corner c2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M1 1h8M1 1v8M1 1l8 8"/><path d="M5 5.5 6 8.6l3.1 1-3.1 1-1 3.1-1-3.1L.9 9.6l3.1-1Z" fill="currentColor" stroke="none" opacity=".8"/></svg>
  <svg class="corner c3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M23 23h-8M23 23v-8M23 23l-8-8"/><path d="M19 9.4 20 12.5l3.1 1-3.1 1-1 3.1-1-3.1-3.1-1 3.1-1Z" fill="currentColor" stroke="none" opacity=".8"/></svg>
  <svg class="corner c4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M1 23h8M1 23v-8M1 23l8-8"/><path d="M5 9.4 6 12.5l3.1 1-3.1 1-1 3.1-1-3.1-3.1-1 3.1-1Z" fill="currentColor" stroke="none" opacity=".8"/></svg>`;

const RULE = `<div class="hr"><span></span><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 13.8 10.2 22 12 13.8 13.8 12 22 10.2 13.8 2 12 10.2 10.2Z"/></svg><span></span></div>`;

const BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#efe7d8}
:root{--paper:#faf6ef;--ink:#2c2620;--ink-2:#5c534a;--gold:#b08d57;--gold-d:#816539;--gold-l:#d4b77e}
#card{position:relative;width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;background:var(--paper);overflow:hidden;
 font-family:"Amiri",serif;color:var(--ink);display:flex;flex-direction:column;align-items:center}
#card::before{content:"";position:absolute;inset:0;background-image:url("${STAR_TILE}")}
#card::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 80% 55% at 50% 20%,rgba(255,250,240,.72),transparent 70%)}
.frame{position:absolute;border:2px solid var(--gold-l);opacity:.85;inset:44px}
.frame.i{inset:58px;border-width:1px;opacity:.5}
.corner{position:absolute;width:72px;height:72px;color:var(--gold);opacity:.9}
.c1{top:28px;right:28px}.c2{top:28px;left:28px}.c3{bottom:28px;right:28px}.c4{bottom:28px;left:28px}
#in{position:relative;z-index:3;width:100%;text-align:center;display:flex;flex-direction:column;align-items:center}
.hr{margin-top:22px;display:flex;align-items:center;gap:18px;color:var(--gold)}
.hr span{width:130px;height:1px;background:linear-gradient(90deg,transparent,var(--gold-l),transparent)}
#foot{position:absolute;bottom:64px;left:0;right:0;z-index:3;text-align:center}
#foot .note{font-size:27px;color:var(--gold-d)}
#foot .u{margin-top:10px;font-size:22px;letter-spacing:.18em;color:var(--gold-d);opacity:.7;font-family:"Cormorant Garamond",serif}
body.en #card{direction:ltr;font-family:"Cormorant Garamond",serif}
`;

const QR_CSS = `
#card{padding:92px 96px 120px}
.couple{font-family:"Aref Ruqaa",serif;font-size:56px;color:var(--gold-d);line-height:1.5}
.kick{margin-top:14px;font-size:26px;letter-spacing:.24em;color:var(--ink-2)}
/* the plate: the code keeps a real white quiet zone, because at the door this
   is read by a phone camera at arm's length and a decorated code is a code
   that has to be tried twice */
#plate{margin-top:34px;position:relative;width:520px;height:520px;background:#fff;border:2px solid var(--gold-l);
 border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 18px 44px rgba(129,101,57,.14)}
#plate .tick{position:absolute;width:46px;height:46px;border:3px solid var(--gold);opacity:.9}
.t1{top:-3px;right:-3px;border-left:0;border-bottom:0;border-radius:0 26px 0 0}
.t2{top:-3px;left:-3px;border-right:0;border-bottom:0;border-radius:26px 0 0 0}
.t3{bottom:-3px;right:-3px;border-left:0;border-top:0;border-radius:0 0 26px 0}
.t4{bottom:-3px;left:-3px;border-right:0;border-top:0;border-radius:0 0 0 26px}
#qr{width:430px;height:430px;image-rendering:pixelated}
.guest-k{margin-top:34px;font-size:24px;letter-spacing:.2em;color:var(--ink-2)}
.guest{margin-top:10px;font-family:"Aref Ruqaa",serif;font-size:56px;color:var(--ink);line-height:1.45}
.seats{margin-top:10px;font-size:28px;color:var(--gold-d)}
.meta{margin-top:22px;font-size:27px;line-height:1.8;color:var(--ink-2)}
body.en .couple{font-family:"Great Vibes",cursive;font-size:64px}
body.en .guest{font-family:"Cormorant Garamond",serif;font-weight:400;font-size:52px}
body.en .kick,body.en .guest-k{text-transform:uppercase;letter-spacing:.3em;font-size:25px}
`;

const THANKS_CSS = `
#card{padding:140px 110px 300px;justify-content:center}
.star{color:var(--gold);width:78px;height:78px}
.kicker{margin-top:34px;font-size:34px;letter-spacing:.22em;color:var(--gold-d)}
h1{margin-top:26px;font-family:"Aref Ruqaa",serif;font-weight:700;font-size:96px;line-height:1.45;color:var(--ink)}
.hr{margin-top:46px}
.body{margin-top:44px;font-size:41px;line-height:2.05;color:var(--ink-2);max-width:21ch}
.names{margin-top:56px;font-family:"Aref Ruqaa",serif;font-size:78px;color:var(--gold-d);line-height:1.6}
.meta{margin-top:26px;font-size:32px;color:var(--ink-2);letter-spacing:.06em}
#foot{bottom:104px}
#foot .w{font-family:"Aref Ruqaa",serif;font-size:36px;color:var(--gold-d)}
body.en h1{font-family:"Cormorant Garamond",serif;font-weight:300;font-size:74px;letter-spacing:.02em}
body.en .names{font-family:"Great Vibes",cursive;font-size:80px}
body.en .kicker{font-size:30px;letter-spacing:.34em;text-transform:uppercase}
body.en .body{font-size:35px;line-height:1.8;max-width:26ch}
`;

const STAR = `<svg class="star" viewBox="0 0 64 64" fill="none"><path d="M32 4 L37.5 26.5 L60 32 L37.5 37.5 L32 60 L26.5 37.5 L4 32 L26.5 26.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M32 20 L34.4 29.6 L44 32 L34.4 34.4 L32 44 L29.6 34.4 L20 32 L29.6 29.6 Z" fill="currentColor" opacity=".85"/></svg>`;

function shell({ lang, css, body }) {
  const en = lang === "en";
  return `<!doctype html>
<html lang="${en ? "en" : "ar"}" dir="${en ? "ltr" : "rtl"}"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${BASE_CSS}${css}</style></head>
<body class="${en ? "en" : ""}">
<div id="card">
  <div class="frame"></div><div class="frame i"></div>${CORNERS}
  ${body}
</div>
</body></html>`;
}

/**
 * The entry pass. `qr` is a data: URL for the guest's code — passed in rather
 * than generated here so this module stays render-only.
 */
export function qrCardHtml({
  lang = "ar",
  qr,
  coupleNames,
  guestName,
  seats,
  dateLine,
  venueLine,
  kicker,
  note,
}) {
  const en = lang === "en";
  return shell({
    lang,
    css: QR_CSS,
    body: `
  <div id="in">
    <div class="couple">${esc(coupleNames)}</div>
    <div class="kick">${esc(kicker || (en ? "Entry pass" : "بطاقة الدخول"))}</div>
    ${RULE}
    <div id="plate">
      <div class="tick t1"></div><div class="tick t2"></div><div class="tick t3"></div><div class="tick t4"></div>
      <img id="qr" src="${esc(qr)}" alt="">
    </div>
    <div class="guest-k">${en ? "Guest" : "الضيف"}</div>
    <div class="guest">${esc(guestName)}</div>
    ${seats ? `<div class="seats">${esc(seats)}</div>` : ""}
    <div class="meta">${lines([dateLine, venueLine])}</div>
  </div>
  <div id="foot">
    <div class="note">${esc(note || (en ? "Please show this code at the door" : "اعرض هذا الرمز عند الباب"))}</div>
    <div class="u">da3wa.digital</div>
  </div>`,
  });
}

/** The note that goes out the day after the wedding. */
export function thanksCardHtml({ lang = "ar", kicker, headline, body, coupleNames, dateLine }) {
  const en = lang === "en";
  return shell({
    lang,
    css: THANKS_CSS,
    body: `
  <div id="in">
    ${STAR}
    <div class="kicker">${esc(kicker || (en ? "With gratitude" : "شكرًا لكم"))}</div>
    <h1>${esc(headline)}</h1>
    ${RULE}
    <div class="body">${esc(body)}</div>
    <div class="names">${esc(coupleNames)}</div>
    ${dateLine ? `<div class="meta">${esc(dateLine)}</div>` : ""}
  </div>
  <div id="foot"><div class="w">دعوة</div><div class="u">da3wa.digital</div></div>`,
  });
}
