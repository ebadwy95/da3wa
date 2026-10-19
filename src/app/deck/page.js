import { getDb } from "@/lib/db";
import { guestKind } from "@/lib/guestKind";
import { onRoll } from "@/lib/roll";
import { PRIVATE_ROUTE_METADATA, siteOrigin } from "@/lib/seo";
import DeckKeys from "./DeckKeys";

// The pitch, as six screens.
//
// Built as a page rather than a slide file for one reason: the numbers on
// slide five are read out of the database when the deck is opened. A deck
// with last month's figures in it is the thing a buyer catches you on, and
// "this is live, it is a wedding running right now" is a stronger sentence
// than any chart.
//
// Arrow keys and swipe move between slides; the browser's own print dialog
// turns it into the PDF to email afterwards. No library.
export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_ROUTE_METADATA, title: "دعوة — العرض" };

async function liveNumbers() {
  try {
    const db = await getDb();
    // The busiest live wedding on the platform: the one worth showing.
    const counts = new Map();
    for (const g of onRoll(db.guests || [])) {
      counts.set(g.eventId, (counts.get(g.eventId) || 0) + 1);
    }
    let best = null;
    for (const e of db.events || []) {
      if (e.status !== "active" || e.isDemo) continue;
      const n = counts.get(e.id) || 0;
      if (!best || n > best.n) best = { event: e, n };
    }
    if (!best) return null;
    const guests = onRoll(db.guests || []).filter(
      (g) => g.eventId === best.event.id && guestKind(g) === "invite"
    );
    const confirmed = guests.filter((g) => g.status === "confirmed");
    return {
      invites: guests.length,
      confirmed: confirmed.length,
      people: confirmed.reduce((s, g) => s + 1 + (g.confirmedCompanions || 0), 0),
      declined: guests.filter((g) => g.status === "declined").length,
      answered: Math.round(
        ((confirmed.length + guests.filter((g) => g.status === "declined").length) /
          Math.max(1, guests.length)) * 100
      ),
    };
  } catch {
    return null;
  }
}

function Slide({ children, dark = false, id }) {
  return (
    <section id={id} className={`deck-slide${dark ? " band-dark" : ""}`}>
      <div className="deck-inner">{children}</div>
    </section>
  );
}

export default async function DeckPage() {
  const n = await liveNumbers();
  const base = siteOrigin();

  return (
    <main className="deck">
      <DeckKeys />

      <Slide dark id="s1">
        <div className="aurora" aria-hidden="true" />
        <span className="hero-eyebrow self-center">دعوة</span>
        <h1 className="deck-h1">
          قالوا لك مئتان.
          <br />
          جاء مئتان وستون.
        </h1>
        <p className="deck-p">
          البوفيه كان لمئتين، والكراسي لمئتين. الفرق يدفعه صاحب الحفل، ويُلام عليه مُنظّمه.
          <br />
          المشكلة ليست في الدعوات — المشكلة أن الرقم كان تخمينًا.
        </p>
      </Slide>

      <Slide id="s2">
        <h2 className="deck-h2">نحوّل الرقم من تخمين إلى رقم أحد مسؤول عنه</h2>
        <p className="deck-p">
          دعوة شخصية لكل ضيف على واتساب. يفتحها، يؤكّد، <b>ويختار كم فردًا سيحضر معه</b>.
          <br />
          الرقم يتحدّث لحظة بلحظة، مقسومًا على طرف العريس وطرف العروس.
        </p>
        <p className="deck-note">هذا هو الرقم الذي يبني عليه المطبخ والقاعة. ليس تقديرًا.</p>
      </Slide>

      <Slide dark id="s3">
        <h2 className="deck-h2">ثم نقف على بابك</h2>
        <p className="deck-p">
          كل ضيف مؤكّد تصله بطاقة دخول مكتوب عليها <b>عدده بالضبط</b>. موظف الباب يمسحها،
          فيعرف في ثانية كم يدخل الآن.
        </p>
        <p className="deck-p">
          ولو قدّم أحدهم بطاقة مُسحت من قبل — <b>ترنّ جوالات فريق الأمن في نفس اللحظة</b>، وتظل ترنّ
          حتى يردّ أحدهم.
        </p>
        <p className="deck-note">هذه ليست دعوات. هذه سيطرة على الباب.</p>
      </Slide>

      <Slide id="s4">
        <h2 className="deck-h2">ولا ينزّل الضيف شيئًا</h2>
        <p className="deck-p">
          رسالة واتساب ورابط. لا تطبيق، لا حساب، لا كلمة مرور.
          <br />
          نفس الرابط يصير بطاقة دخوله، وفيه موقع القاعة وزر يضيف الموعد إلى تقويمه.
        </p>
        <p className="deck-note">
          ولمن لا يُطلب منهم فتح رابط — الأهل وكبار الضيوف — قائمة بالأسماء تُطبع في ورقة واحدة
          بيد موظف الباب.
        </p>
      </Slide>

      <Slide dark id="s5">
        <h2 className="deck-h2">من زفاف يعمل على المنصّة الآن</h2>
        {n ? (
          <div className="deck-stats">
            <div><b className="tnum">{n.invites}</b><span>دعوة</span></div>
            <div><b className="tnum">{n.people}</b><span>فردًا مؤكّدًا</span></div>
            <div><b className="tnum">{n.answered}%</b><span>ردّوا</span></div>
          </div>
        ) : (
          <p className="deck-p">افتح العرض الحيّ وجرّبها بنفسك.</p>
        )}
        <p className="deck-note">
          هذه الأرقام تُقرأ من قاعدة البيانات في اللحظة التي تفتح فيها هذه الشريحة — لا شيء مكتوب
          مسبقًا.
        </p>
      </Slide>

      <Slide id="s6">
        <h2 className="deck-h2">جرّبها الآن، وأنت واقف</h2>
        <p className="deck-p">
          امسح الرمز على البطاقة التي بيدك — ستفتح دعوة حقيقية باسمك، تؤكّد حضورك، وترى بطاقة
          دخولك تظهر. أقل من دقيقة.
        </p>
        <div className="deck-cta">
          <a href={`${base}/demo`} className="pill-btn shine">العرض الحيّ</a>
          <a href={`${base}`} className="pill-btn-outline">الموقع</a>
        </div>
        <p className="deck-note">hello@da3wa.digital · www.da3wa.digital</p>
      </Slide>
    </main>
  );
}
