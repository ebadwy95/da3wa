"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The number a planner is actually waiting for, big enough to read from
// across a room, with the two sides beside it and a rate underneath.
//
// Everything here is one glance: a planner checks this between a hundred
// other things, standing up, holding a phone in one hand. No tabs, no
// filters, no scrolling to the number that matters.

const POLL_MS = 10000;

// Arrivals in the last quarter of an hour, turned into "when will the hall be
// full". A wedding fills in bursts — a bus of twenty, then nobody for ten
// minutes — so a rate measured over the whole night is useless by nine
// o'clock. This looks only at the recent slope.
const RATE_WINDOW_MS = 15 * 60 * 1000;

function useFloor(floorKey) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  // Whether anything has ever loaded, kept in a ref so the fetch callback
  // doesn't have to depend on the data it sets.
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/floor/${floorKey}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "تعذّر التحديث");
      setData(await res.json());
      loaded.current = true;
      setError(null);
      setStale(false);
    } catch (err) {
      // A dropped signal in a basement hall is the normal case, not a crash:
      // keep the last numbers on screen and say they are no longer live.
      setStale(true);
      if (!loaded.current) setError(err.message);
    }
  }, [floorKey]);

  useEffect(() => {
    // Off the effect body rather than in it, so the first paint is the
    // loading state and not a render cascade.
    const first = setTimeout(load, 0);
    const poll = setInterval(load, POLL_MS);
    const wake = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [load]);

  return { data, error, stale, reload: load };
}

function rateFrom(arrivals, now) {
  if (!arrivals || arrivals.length < 2) return null;
  const since = now - RATE_WINDOW_MS;
  const recent = arrivals.filter((t) => t >= since);
  if (recent.length < 2) return null;
  const span = Math.max(now - recent[0], 60000);
  return (recent.length / span) * 60000; // parties per minute
}

function Side({ label, side, tone }) {
  const pct = side.expected ? Math.round((side.inside / side.expected) * 100) : 0;
  return (
    <div className="floor-side">
      <span className="floor-side-label" style={{ color: tone }}>{label}</span>
      <div className="floor-side-num tnum">
        <b>{side.inside}</b>
        <span>من {side.expected}</span>
      </div>
      <div className="floor-bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, pct)}%`, background: tone }} />
      </div>
      <span className="floor-side-meta tnum">
        {side.arrivedCards} من {side.cards} دعوة وصلت
      </span>
    </div>
  );
}

export default function FloorScreen({ floorKey }) {
  const { data, error, stale, reload } = useFloor(floorKey);

  if (error && !data) {
    return (
      <main className="floor-wrap">
        <div className="floor-card">
          <h1 className="title" style={{ color: "var(--danger)" }}>{error}</h1>
          <p className="meta">اطلب رابطًا جديدًا من إدارة دعوة.</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="floor-wrap">
        <div className="floor-card"><p className="meta">جارٍ القراءة…</p></div>
      </main>
    );
  }

  const { total, groom, bride, arrivals, now } = data;
  const pct = total.expected ? Math.round((total.inside / total.expected) * 100) : 0;
  const rate = rateFrom(arrivals, now);
  const left = total.expected - total.inside;

  // Parties left, not people: the rate is measured in parties through the
  // door, and a party is whatever walks up together.
  const partiesLeft = total.cards - total.arrivedCards;
  const etaMin = rate && partiesLeft > 0 ? Math.round(partiesLeft / rate) : null;
  const etaAt =
    etaMin !== null && etaMin < 600
      ? new Date(now + etaMin * 60000).toLocaleTimeString("ar-EG", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kuwait",
        })
      : null;

  return (
    <main className="floor-wrap">
      <header className="floor-head">
        <span className="floor-couple">{data.coupleNames}</span>
        <button className="floor-refresh" onClick={reload} aria-label="تحديث">
          {stale ? "غير محدّث — اضغط" : "محدّث الآن"}
        </button>
      </header>

      <section className="floor-sides">
        <Side label="طرف العريس" side={groom} tone="var(--gold-600, #b08d57)" />
        <Side label="طرف العروس" side={bride} tone="#8a7bb8" />
      </section>

      <section className="floor-main">
        <span className="floor-main-label">في القاعة الآن</span>
        <b className="floor-main-num tnum">{total.inside}</b>
        <span className="floor-main-sub tnum">من {total.expected} مؤكّدًا · {pct}%</span>
        <div className="floor-bar floor-bar-lg" aria-hidden="true">
          <i style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </section>

      <section className="floor-foot">
        <div className="floor-stat">
          <b className="tnum">{left > 0 ? left : 0}</b>
          <span>لم يصلوا بعد</span>
        </div>
        <div className="floor-stat">
          <b className="tnum">{total.outside}</b>
          <span>خرجوا مؤقتًا</span>
        </div>
        <div className="floor-stat">
          <b className="tnum">{rate ? Math.round(rate * 10) : "—"}</b>
          <span>دعوة كل ١٠ دقائق</span>
        </div>
      </section>

      {etaAt && (
        <p className="floor-eta">
          على هذا المعدّل، يكتمل العدد حوالي <b className="tnum">{etaAt}</b>
        </p>
      )}
      {!etaAt && partiesLeft > 0 && (
        <p className="floor-eta floor-eta-quiet">لا حركة كافية بعد لتقدير وقت الاكتمال</p>
      )}
      {partiesLeft <= 0 && total.cards > 0 && (
        <p className="floor-eta">وصل جميع المؤكّدين 🤍</p>
      )}
    </main>
  );
}
