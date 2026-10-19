"use client";

import { useState } from "react";

// Pressed between visitors, by someone standing up and talking to the next
// person. One button, one line of feedback, no dialog to dismiss.
export default function DemoReset() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    setBusy(true);
    setDone(false);
    await fetch("/api/demo/reset", { method: "POST" }).catch(() => {});
    setBusy(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <button onClick={reset} disabled={busy} className="pill-btn self-center" style={{ minWidth: "14rem" }}>
      {busy ? "..." : done ? "جاهز للزائر التالي ✓" : "إعادة ضبط العرض"}
    </button>
  );
}
