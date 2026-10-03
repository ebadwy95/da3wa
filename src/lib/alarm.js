// The gate alarm, shared by the door scanner and a guard's alert page: a
// siren that repeats until someone stops it, with the phone vibrating in time.
// Browser-only.
//
// Browsers only let a page make sound after the person has touched it, so
// unlockAudio() must run inside a tap (the scanner's login, the guard's
// "activate" button) — after that the alarm can go off on its own.

let ctx = null;
let timer = null;

function context() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

export function unlockAudio() {
  const c = context();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function siren(seconds = 1.6) {
  const c = context();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  // Square rather than the scanner's old sawtooth: it carries further over a
  // wedding's music on a phone speaker.
  osc.type = "square";
  let t = now;
  osc.frequency.setValueAtTime(600, t);
  while (t < now + seconds) {
    osc.frequency.linearRampToValueAtTime(1300, t + 0.4);
    osc.frequency.linearRampToValueAtTime(600, t + 0.8);
    t += 0.8;
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
  gain.gain.setValueAtTime(0.5, now + seconds - 0.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + seconds);
}

/** Sounds once — a rejection that needs noticing but not an emergency. */
export function beepAlarm() {
  siren(1.6);
  navigator.vibrate?.([400, 150, 400]);
}

/** Sounds until stopAlarm() — an emergency that needs an answer. */
export function startAlarm() {
  stopAlarm();
  const ring = () => {
    siren(1.6);
    navigator.vibrate?.([700, 200, 700, 200, 700]);
  };
  ring();
  timer = setInterval(ring, 2000);
}

export function stopAlarm() {
  if (timer) clearInterval(timer);
  timer = null;
  navigator.vibrate?.(0);
}

/** Keeps the screen on while a door shift is running, where supported. */
export async function keepScreenOn() {
  try {
    return await navigator.wakeLock?.request("screen");
  } catch {
    return null;
  }
}

/** Registers the alert service worker (public/sw.js). */
export async function registerAlertWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}
