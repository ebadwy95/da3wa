"use client";

import { useEffect, useState } from "react";
import {
  GroomIcon,
  BrideIcon,
  DinnerIcon,
  ZaffaIcon,
  CameraIcon,
  FireworksIcon,
  StarOrnamentIcon,
} from "@/components/icons";

// The order of the night, with the mark sliding down it as the night runs.
//
// The reference this was modelled on slides a pearl; ours slides the
// eight-point star, because that is already the logo, the seal on the
// envelope and the ornament between sections. Borrowing their pearl would
// have been borrowing their brand.
//
// Before the wedding the mark rests at the top and the whole list reads as a
// plan. During the evening it tracks real time, so a guest glancing at their
// phone can see the zaffa is next. After midnight it sits at the end.

const STEPS = [
  { at: "20:30", label: "دخلة العريس", Icon: GroomIcon },
  { at: "20:40", label: "دخلة العروس", Icon: BrideIcon },
  { at: "22:00", label: "العشاء", Icon: DinnerIcon },
  { at: "22:30", label: "الزفة", Icon: ZaffaIcon },
  { at: "23:40", label: "التصوير", Icon: CameraIcon },
  { at: "00:00", label: "ختام الحفل", Icon: FireworksIcon },
];

// "20:30" → minutes past the start of the evening. Midnight belongs to the
// end of the night, not the beginning of it, so anything before the first
// step is pushed a day forward rather than sorting to the top.
function minutes(at, firstAt) {
  const [h, m] = at.split(":").map(Number);
  const v = h * 60 + m;
  return v < firstAt ? v + 1440 : v;
}

function label12(at) {
  const [h, m] = at.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function Timeline({ date }) {
  // null until mounted: the position depends on the reader's clock, and any
  // value picked on the server is a hydration mismatch the moment the browser
  // disagrees.
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!date) return;

    const firstAt = (() => {
      const [h, m] = STEPS[0].at.split(":").map(Number);
      return h * 60 + m;
    })();
    const marks = STEPS.map((s) => minutes(s.at, firstAt));
    const start = marks[0];
    const end = marks[marks.length - 1];

    const tick = () => {
      const now = new Date();
      const evening = new Date(`${date}T00:00:00`);
      const dayMs = 24 * 60 * 60 * 1000;
      const sinceMidnight = (now - evening) / 60000;

      if (sinceMidnight < start) return setProgress(0);
      if (now - evening > dayMs + 60 * 60 * 1000) return setProgress(1);

      const clamped = Math.max(start, Math.min(end, sinceMidnight));
      setProgress((clamped - start) / (end - start));
    };

    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [date]);

  // Positioned by row rather than by pixels: the rows are equal height, so the
  // fraction maps cleanly onto them and the mark lines up with a row's centre
  // instead of floating between two.
  const rows = STEPS.length;
  const top = `calc(${((progress ?? 0) * (rows - 1) + 0.5) * (100 / rows)}% - 9px)`;

  return (
    <div className="tl" role="list">
      <div className="tl-line" aria-hidden="true" />
      <div
        className="tl-mark"
        aria-hidden="true"
        style={{ top, opacity: progress === null ? 0 : 1 }}
      >
        <StarOrnamentIcon size={18} />
      </div>

      {STEPS.map(({ at, label, Icon }) => (
        <div className="tl-row" role="listitem" key={at}>
          <div className="tl-txt">
            <span className="tl-at" dir="ltr">{label12(at)}</span>
            <span className="tl-label">{label}</span>
          </div>
          <span className="tl-icon" aria-hidden="true">
            <Icon size={26} />
          </span>
        </div>
      ))}
    </div>
  );
}
