"use client";

import { useEffect } from "react";

// Tells the sending app the guest opened this page. In the browser on
// purpose: a link preview reads the HTML and never runs this.
export default function GuestPageBeacon({ guestId, purpose, token }) {
  useEffect(() => {
    fetch("/api/guest-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, purpose, t: token }),
    }).catch(() => {});
  }, [guestId, purpose, token]);
  return null;
}
