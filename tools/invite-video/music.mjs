// Synthesises the invitation's music bed from scratch.
//
//   node tools/invite-video/music.mjs --out public/samples/music.mp3
//
// Written rather than sourced: a recorded track is somebody's copyright, and
// an invitation is a public page shared to a few hundred phones. This is
// generated from arithmetic, so there is nothing to license.
//
// The notes sit in maqam Hijaz — the semitone-then-augmented-second step at
// its base is the interval that makes a phrase read as Arabic rather than
// merely minor. A slow arpeggio over a held drone, which is what the form
// wants: something to sit under a voice or a name, not compete with it.

import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SR = 44100;
const DURATION = 24; // loops cleanly under an 8s film played a few times

const FFMPEG_CANDIDATES = [
  "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
  path.join(process.env.LOCALAPPDATA || "", "Microsoft\\WinGet\\Links\\ffmpeg.exe"),
  // winget installs Gyan's build here and does not always add it to PATH.
  path.join(
    process.env.LOCALAPPDATA || "",
    "Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe"
  ),
];
const ffmpeg = FFMPEG_CANDIDATES.find((c) => c && existsSync(c)) || "ffmpeg";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (argv[i]?.startsWith("--")) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

// Hijaz on D: D  Eb  F#  G  A  Bb  C
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const D4 = 62;
const SCALE = [D4, D4 + 1, D4 + 4, D4 + 5, D4 + 7, D4 + 8, D4 + 10, D4 + 12];

// The arpeggio: degree indexes into SCALE, one note every 0.55s. Rises,
// hesitates, falls — a shape rather than a scale run.
const FIGURE = [0, 2, 4, 3, 4, 6, 7, 6, 4, 3, 2, 1, 0, 2, 4, 2];
const NOTE_LEN = 0.55;

// A plucked string is mostly odd harmonics with a fast decay; the small
// detune on the second partial is what stops it sounding like a test tone.
function pluck(freq, age, life) {
  if (age < 0 || age > life) return 0;
  const env = Math.exp(-age * 3.4) * Math.min(1, age * 220);
  const w = 2 * Math.PI * freq * age;
  return (
    env *
    (Math.sin(w) * 0.6 +
      Math.sin(w * 2.001) * 0.18 +
      Math.sin(w * 3) * 0.09 +
      Math.sin(w * 4.002) * 0.04)
  );
}

// The drone underneath: root and fifth, breathing very slightly so it doesn't
// sit perfectly still.
function drone(t) {
  const root = midi(D4 - 12);
  const fifth = midi(D4 - 5);
  const breathe = 0.85 + 0.15 * Math.sin(2 * Math.PI * t * 0.07);
  return (
    breathe *
    (Math.sin(2 * Math.PI * root * t) * 0.16 +
      Math.sin(2 * Math.PI * fifth * t) * 0.07 +
      Math.sin(2 * Math.PI * root * 2 * t) * 0.03)
  );
}

const n = SR * DURATION;
const dry = new Float64Array(n);

for (let i = 0; i < n; i++) {
  const t = i / SR;
  let s = drone(t);
  // Only the few notes that could still be sounding are summed, rather than
  // walking the whole figure for every sample.
  const idx = Math.floor(t / NOTE_LEN);
  for (let k = idx - 3; k <= idx; k++) {
    if (k < 0) continue;
    const deg = FIGURE[k % FIGURE.length];
    const oct = k % (FIGURE.length * 2) >= FIGURE.length ? 12 : 0;
    s += pluck(midi(SCALE[deg] + oct), t - k * NOTE_LEN, 2.4) * 0.3;
  }
  dry[i] = s;
}

// A pair of delays stands in for a room. Cheap, and enough to stop the
// arpeggio sounding like it was recorded inside a box.
const out = new Float64Array(n);
const taps = [
  { d: Math.floor(SR * 0.19), g: 0.34 },
  { d: Math.floor(SR * 0.31), g: 0.22 },
];
for (let i = 0; i < n; i++) {
  let s = dry[i];
  for (const { d, g } of taps) if (i >= d) s += out[i - d] * g;
  out[i] = s;
}

// Fade both ends so looping never clicks.
const fade = SR * 2.5;
let peak = 0;
for (let i = 0; i < n; i++) {
  const f = Math.min(1, i / fade, (n - i) / fade);
  out[i] *= f;
  const a = Math.abs(out[i]);
  if (a > peak) peak = a;
}

// Normalise with headroom rather than to full scale — this plays under a film.
const gain = (0.5 / (peak || 1));
const pcm = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  const v = Math.max(-1, Math.min(1, out[i] * gain));
  pcm.writeInt16LE(Math.round(v * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const args = parseArgs(process.argv);
const outPath = path.resolve(args.out || "public/samples/music.mp3");
const wavPath = path.join(tmpdir(), `da3wa-music-${Date.now()}.wav`);

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(wavPath, Buffer.concat([header, pcm]));

await new Promise((resolve, reject) => {
  const p = spawn(ffmpeg, ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "160k", outPath], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let err = "";
  p.stderr.on("data", (d) => (err += d));
  p.on("error", reject);
  p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-1200)))));
});

await rm(wavPath, { force: true });
console.log(`done -> ${outPath}  (${DURATION}s, maqam Hijaz, generated)`);
