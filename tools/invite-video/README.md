# Invitation films

Generates the 9:16 film and music bed that play behind the tap-to-open cover on
a guest's invitation (see `src/components/InviteOpener.js`).

Both are produced here rather than sourced. A recorded track is somebody's
copyright and an invitation is a public page shared to a few hundred phones, so
the music is synthesised from arithmetic — there is nothing to license. The
film is drawn from the product's own identity: the eight-point ornament, Aref
Ruqaa for the names, the gold-on-near-black palette.

## Render a film

```bash
node tools/invite-video/render.mjs \
  --names "عبدالله و نور" \
  --date  "20 نوفمبر 2026" \
  --venue "قاعة الماسة — الكويت" \
  --audio public/samples/music.mp3 \
  --out   public/samples/invite.mp4
```

`--audio` and `--venue` are optional. Output is 1080x1920, 30fps, 8 seconds,
H.264 in `yuv420p` with `+faststart` — the combination every phone and WhatsApp
preview will actually decode.

## Regenerate the music

```bash
node tools/invite-video/music.mjs --out public/samples/music.mp3
```

24 seconds in maqam Hijaz — the semitone-then-augmented-second step at its base
is the interval that makes a phrase read as Arabic rather than merely minor. A
slow arpeggio over a held drone, mixed to sit under a name rather than compete
with it, faded both ends so looping never clicks.

## How the film is built

`scene.html` exposes `render(t)` and uses **no CSS animation anywhere**. Every
frame is drawn by seeking to an explicit time, so the renderer gets a
byte-identical result for the same inputs and can never capture a frame
mid-transition. `render.mjs` walks the timeline, screenshots each frame through
headless Chrome, and hands the sequence to ffmpeg.

To change the design, edit the timeline block at the bottom of `scene.html` —
each element's opacity and transform is a plain function of `t`, so the whole
choreography is readable in one screen.

## Requirements

Chrome (or Edge) and ffmpeg on the machine, plus `playwright-core` from the
project's devDependencies. Paths for both are probed in the scripts; on Windows
the winget install location is included.
