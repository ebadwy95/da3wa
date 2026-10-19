"use client";

import { useEffect } from "react";

// Arrow keys, space and page keys move a slide at a time. Scroll-snap does
// the rest, which is also what makes swipe work on the tablet without a
// single touch handler.
export default function DeckKeys() {
  useEffect(() => {
    function onKey(e) {
      const forward = ["ArrowRight", "ArrowDown", "PageDown", " "];
      const back = ["ArrowLeft", "ArrowUp", "PageUp"];
      if (!forward.includes(e.key) && !back.includes(e.key)) return;
      e.preventDefault();
      const slides = [...document.querySelectorAll(".deck-slide")];
      const here = slides.findIndex((s) => s.getBoundingClientRect().top > -window.innerHeight / 2);
      const next = Math.min(
        slides.length - 1,
        Math.max(0, (here === -1 ? slides.length - 1 : here) + (forward.includes(e.key) ? 1 : -1))
      );
      slides[next]?.scrollIntoView({ behavior: "smooth" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
