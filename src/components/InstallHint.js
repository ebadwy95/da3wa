"use client";

import { useEffect, useRef, useState } from "react";

// Getting one of the apps (the door scanner, the sending app) onto the home
// screen. Chrome on Android offers its own install prompt, which the button
// triggers; when it doesn't offer one (another browser, or a prompt already
// dismissed) the menu steps are spelled out instead. iPhone has no prompt at
// all, so it always gets the three taps. Hidden once running as the app.
export default function InstallHint({ label, appName }) {
  const [mode, setMode] = useState(null); // "prompt" | "android" | "ios" | null
  const prompt = useRef(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document)) {
      setMode("ios");
      return;
    }
    const onPrompt = (e) => {
      e.preventDefault();
      prompt.current = e;
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const fallback = /Android/i.test(ua)
      ? setTimeout(() => setMode((m) => m || "android"), 2500)
      : null;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (fallback) clearTimeout(fallback);
    };
  }, []);

  if (mode === "prompt") {
    return (
      <button
        type="button"
        onClick={async () => {
          prompt.current?.prompt();
          await prompt.current?.userChoice;
          setMode(null);
        }}
        className="pill-btn-outline w-full"
      >
        📲 {label}
      </button>
    );
  }
  if (mode === "android") {
    return (
      <div className="card-flat p-3 text-right leading-relaxed" style={{ fontSize: "var(--text-sm)" }}>
        <p className="font-bold mb-1">📲 {label}:</p>
        من Chrome اضغط النقاط الثلاث <b>⋮</b> فوق ← <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>،
        وبعدين افتحه من أيقونة <b>«{appName}»</b>.
      </div>
    );
  }
  if (mode === "ios") {
    return (
      <div className="card-flat p-3 text-right leading-relaxed" style={{ fontSize: "var(--text-sm)" }}>
        <p className="font-bold mb-1">📲 {label} على الآيفون:</p>
        من Safari اضغط زر <b>المشاركة</b> (المربع اللي طالع منه سهم) ← <b>«إضافة إلى الشاشة الرئيسية»</b> ←
        «إضافة»، وبعدين افتحه من أيقونة <b>«{appName}»</b>.
      </div>
    );
  }
  return null;
}
