// The video of a tutorial is composed, not recorded: each frame is drawn from the stills of the
// steps and from the timeline below, so no load, scroll or dropped frame of a live session can
// reach it. Frame n is a function of the tutorial alone.
import { spawn } from "node:child_process";
import { globSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { RATIO, VIEW } from "./app.mjs";

export const FPS = 30;
// The whole screen, never a zoomed part of it, at one and a half device pixels per CSS pixel:
// the reader sees where each control stands, and the enlarged player stays sharp.
const SCALE = 1.5;
const OUT = { width: VIEW.width * SCALE, height: VIEW.height * SCALE };

// Seconds of each part of a beat.
const TRAVEL = 0.9;
const HOLD_STEP = 1.7;
const HOLD_BRIDGE = 0.5;
const CLICK = 0.35;
const FADE = 0.3;
const END = 1.4;

export function timeline(beats) {
  const shown = beats.filter((b) => b.inVideo);
  let at = 0;
  let number = 0;

  const parts = shown.map((beat) => {
    const hold = beat.figure ? HOLD_STEP : HOLD_BRIDGE;
    const part = {
      start: at,
      travel: TRAVEL,
      hold,
      click: beat.clicks ? CLICK : 0,
      number: beat.figure ? ++number : 0,
      clip: beat.clip,
      mark: beat.mark,
    };

    at += TRAVEL + hold + part.click;

    return part;
  });

  return { parts, duration: at + END, fade: FADE };
}

// The page that draws a frame. It holds no clock: render(t) is called with the time of the frame.
const COMPOSITOR = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#000"><canvas id="c" width="${OUT.width}" height="${OUT.height}"></canvas>
<script>
const R = ${SCALE}, S = ${RATIO}, W = ${OUT.width}, H = ${OUT.height}, VW = ${VIEW.width}, VH = ${VIEW.height};
const ctx = document.getElementById("c").getContext("2d");
ctx.imageSmoothingQuality = "high";
let stills = [], line = null, accent = "#7c5cff";
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mix = (a, b, k) => a + (b - a) * k;
const clamp = (x) => Math.max(0, Math.min(1, x));
const centre = (p) => ({ x: p.clip.x + p.mark.x + p.mark.width / 2, y: p.clip.y + p.mark.y + p.mark.height / 2 });

window.load = async (urls, timeline, colour) => {
  line = timeline; accent = colour;
  stills = await Promise.all(urls.map(async (url) => { const i = new Image(); i.src = url; await i.decode(); return i; }));
};

function round(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

window.render = (t) => {
  const parts = line.parts;
  let i = parts.findLastIndex((p) => t >= p.start);
  if (i < 0) i = 0;
  const part = parts[i], before = parts[i - 1] ?? part;
  const local = t - part.start;
  const k = ease(clamp(local / part.travel));

  // The frame is the whole screen; only the pointer travels, from the beat before to this one.
  const cam = { x: 0, y: 0 };
  const from = i === 0 ? { x: VW / 2, y: VH * 0.8 } : centre(before);
  const to = centre(part);
  const pointer = { x: mix(from.x, to.x, k), y: mix(from.y, to.y, k) };

  ctx.globalAlpha = 1;
  if (i > 0 && local < line.fade) {
    ctx.drawImage(stills[i - 1], 0, 0, VW * S, VH * S, 0, 0, W, H);
    ctx.globalAlpha = clamp(local / line.fade);
  }
  ctx.drawImage(stills[i], 0, 0, VW * S, VH * S, 0, 0, W, H);
  ctx.globalAlpha = 1;

  // The mark of the step: the same outline and number the figure carries.
  const held = local - part.travel;
  if (held > 0) {
    const show = clamp(held / 0.25);
    const m = part.mark, x = (part.clip.x - cam.x + m.x) * R, y = (part.clip.y - cam.y + m.y) * R;
    ctx.globalAlpha = show;
    round(x, y, m.width * R, m.height * R, 8 * R);
    ctx.lineWidth = 2 * R; ctx.strokeStyle = accent; ctx.stroke();
    if (part.number > 0) {
      ctx.beginPath(); ctx.arc(x, y, 10.5 * R, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "600 " + 11 * R + "px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(part.number), x, y + R * 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // The click: a ring that opens from the pointer.
  const px = (pointer.x - cam.x) * R, py = (pointer.y - cam.y) * R;
  const clicked = local - part.travel - part.hold;
  if (part.click > 0 && clicked > 0) {
    const c = clamp(clicked / part.click);
    ctx.beginPath(); ctx.arc(px, py, (6 + 18 * c) * R, 0, Math.PI * 2);
    ctx.lineWidth = 2 * R; ctx.strokeStyle = accent; ctx.globalAlpha = 1 - c; ctx.stroke(); ctx.globalAlpha = 1;
  }

  // The pointer: an arrow with a white body and a dark edge, legible on both schemes.
  ctx.save(); ctx.translate(px, py); ctx.scale(R * 1.4, R * 1.4);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.6, 13); ctx.lineTo(7.6, 19.6);
  ctx.lineTo(10.2, 18.4); ctx.lineTo(7.3, 12); ctx.lineTo(13, 12); ctx.closePath();
  ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  ctx.fillStyle = "#fff"; ctx.fill(); ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.2; ctx.strokeStyle = "#111"; ctx.lineJoin = "round"; ctx.stroke(); ctx.restore();

  return document.getElementById("c").toDataURL("image/jpeg", 1);
};
</script>`;

function ffmpegPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), ".cache/ms-playwright");
  const found = globSync(join(root, "ffmpeg-*/ffmpeg-*")).sort().at(-1);
  if (found === undefined) throw new Error('no ffmpeg: run "pnpm exec playwright install ffmpeg"');

  return found;
}

// Draws every frame and encodes them as VP9 at constant quality. Returns the frames written.
export async function renderVideo(browser, beats, accent, path) {
  const line = timeline(beats);
  const frames = Math.round(line.duration * FPS);
  const page = await browser.newPage({ viewport: OUT, deviceScaleFactor: 1 });
  const stills = beats.filter((b) => b.inVideo).map((b) => b.still);

  await page.route("http://stills.invalid/*", (route) => {
    const index = Number(new URL(route.request().url()).pathname.slice(1));

    return route.fulfill({ contentType: "image/png", body: stills[index] });
  });
  await page.route("http://stills.invalid/", (route) => route.fulfill({ contentType: "text/html", body: COMPOSITOR }));
  await page.goto("http://stills.invalid/");
  await page.evaluate(([urls, timeline, colour]) => window.load(urls, timeline, colour), [
    stills.map((_, index) => `http://stills.invalid/${index}`),
    line,
    accent,
  ]);

  const encoder = spawn(ffmpegPath(), [
    "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0",
    "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-g", String(FPS * 2),
    "-cpu-used", "2",
    // One thread and exact bit streams: the same frames give the same file.
    "-threads", "1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-map_metadata", "-1",
    "-vf", "format=yuv420p", "-an", path,
  ]);
  let errors = "";
  encoder.stderr.on("data", (chunk) => (errors += chunk));
  const done = new Promise((resolve, reject) => {
    encoder.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg: ${errors}`))));
  });

  for (let frame = 0; frame < frames; frame++) {
    const url = await page.evaluate((t) => window.render(t), frame / FPS);
    const ok = encoder.stdin.write(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
    if (!ok) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
  }

  encoder.stdin.end();
  await done;
  await page.close();

  return { frames, seconds: Math.round(line.duration) };
}
