"use client";

import { useEffect, useRef } from "react";

// Reveals its children as they scroll into view.
//
// Content is visible by default and only *becomes* animatable once this
// mounts, which is the important part: with JavaScript disabled, or before
// hydration, or to a crawler, the page reads completely. Marking things
// invisible in CSS and hoping JS turns them back on hides the page from anyone
// the script never reaches.
//
// A short fade with a small lift — the offset stays under 16px so it reads as
// a fade rather than a slide. Anyone who has asked for reduced motion simply
// gets the final state.
export function Reveal({ children, delay = 0, as: Tag = "div", className = "", ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.dataset.reveal = "pending";

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.dataset.reveal = "shown";
          // One-shot: re-animating on every scroll past turns a page into a
          // flicker for anyone reading back over it.
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={className} style={{ "--reveal-delay": `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
