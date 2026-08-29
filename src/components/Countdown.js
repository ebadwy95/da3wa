"use client";

import { useEffect, useState } from "react";

// Days, hours and minutes until the wedding.
//
// Rendered as null on the server and on the first client paint: the value
// depends on the reader's clock, and any number chosen on the server is a
// hydration mismatch the moment the browser disagrees. It appears one tick
// after mount instead, which nobody notices and React never complains about.
//
// Minutes, not seconds. A seconds counter on a wedding invitation is a
// stopwatch — it pulls the eye and repaints forever on a page people leave
// open. The minute tick is aligned to the wall clock so it changes when the
// reader's own clock does.

function remaining(target) {
  const ms = target - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  return { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 };
}

export function Countdown({ date, time }) {
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (!date) return;
    // Local time on purpose — the guest is travelling to this venue, so the
    // countdown should match the clock in the room they are standing in.
    const target = new Date(`${date}T${time || "00:00"}:00`).getTime();
    if (!Number.isFinite(target)) return;

    const tick = () => setLeft(remaining(target));
    tick();

    let interval;
    // Line the first update up with the next whole minute, then settle into a
    // steady beat — otherwise the display lags the clock by up to 59 seconds.
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60000);
    }, 60000 - (Date.now() % 60000));

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [date, time]);

  if (!left) return null;

  return (
    <div className="inv-count" role="timer" aria-label="الوقت المتبقي على المناسبة">
      {[
        [left.days, "يوم"],
        [left.hours, "ساعة"],
        [left.minutes, "دقيقة"],
      ].map(([value, label]) => (
        <div key={label}>
          <b>{String(value).padStart(2, "0")}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
