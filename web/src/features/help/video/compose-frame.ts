// The video of a help page, frame by frame: the state of the frame at second t, from the
// timeline tools/help-media writes (ADR 037, 7). The canvas layer (draw-frame.ts) draws it; the
// review page of the tool runs this file as it stands.

export interface VideoMark {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoPart {
  start: number;
  travel: number;
  hold: number;
  click: number;
  // The number of the step on its mark; 0 for a click the page does not number.
  number: number;
  // The element of the step, in CSS pixels of the screen.
  mark: VideoMark;
}

export interface VideoTimeline {
  parts: readonly VideoPart[];
  duration: number;
  fade: number;
}

export interface VideoPoint {
  x: number;
  y: number;
}

export interface VideoFrame {
  // The still on top, and the still under it while the cross-fade runs.
  still: number;
  under: number | undefined;
  // The opacity of the still on top.
  fade: number;
  mark: VideoMark;
  number: number;
  // The centre of the number: the corner of the mark, moved inside the screen.
  badge: VideoPoint;
  markOpacity: number;
  pointer: VideoPoint;
  // The progress of the click from 0 to 1; -1 outside it.
  click: number;
  // The scale of the pointer as it presses down and comes back.
  press: number;
}

// The screen the stills were taken of, in CSS pixels.
export const VIDEO_VIEW = { width: 1920, height: 1200 };

// Seconds the mark takes to appear once the pointer rests.
const MARK_IN = 0.25;
// The radius of the number of a mark, in CSS pixels: the 21 px circle of the figure.
const BADGE = 10.5;

const ease = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (x: number) => Math.max(0, Math.min(1, x));

export function frameAt(line: VideoTimeline, t: number): VideoFrame {
  const index = partAt(line, t);
  const part = partOf(line, index);
  const before = index > 0 ? partOf(line, index - 1) : undefined;
  const local = t - part.start;
  const k = ease(clamp(local / part.travel));

  const from = before === undefined ? start() : rest(before);
  const to = rest(part);
  const fading = before !== undefined && local < line.fade;

  const held = local - part.travel;
  const clicked = held - part.hold;
  const click =
    part.click > 0 && clicked > 0 ? clamp(clicked / part.click) : -1;

  return {
    still: index,
    under: fading ? index - 1 : undefined,
    fade: fading ? clamp(local / line.fade) : 1,
    mark: part.mark,
    number: part.number,
    badge: {
      x: Math.max(part.mark.x, BADGE),
      y: Math.max(part.mark.y, BADGE),
    },
    markOpacity: held > 0 ? clamp(held / MARK_IN) : 0,
    pointer: { x: mix(from.x, to.x, k), y: mix(from.y, to.y, k) },
    click,
    press: click >= 0 ? 1 - 0.2 * Math.sin(Math.PI * clamp(click * 1.8)) : 1,
  };
}

// The part a second falls in: the last one that started at or before it.
export function partAt(line: VideoTimeline, t: number): number {
  const started = line.parts.filter((part) => t >= part.start).length;

  return Math.max(0, started - 1);
}

// An instant of the part of t at which the pointer rests on its element and the mark is whole:
// the one frame of the part drawn under reduced motion.
export function restingAt(line: VideoTimeline, t: number): number {
  const part = partOf(line, partAt(line, t));

  // The middle of the hold: past the quarter of a second the mark takes, before the click.
  return part.start + part.travel + part.hold / 2;
}

// The start of the next part (or the end of the video), or of the part before.
export function stepFrom(
  line: VideoTimeline,
  t: number,
  direction: 1 | -1,
): number {
  const starts = line.parts.map((part) => part.start);

  if (direction === 1) return starts.find((s) => s > t) ?? line.duration;

  return starts.filter((s) => s < t).at(-1) ?? 0;
}

function partOf(line: VideoTimeline, index: number): VideoPart {
  const part = line.parts[index];
  if (part === undefined) throw new Error("a help video has no part");

  return part;
}

// Where the pointer enters: low in the middle of the screen.
function start(): VideoPoint {
  return { x: VIDEO_VIEW.width / 2, y: VIDEO_VIEW.height * 0.8 };
}

// Where the pointer rests on a target: below and after its centre, so the tip is inside the
// element and the arrow leaves its label readable.
function rest(part: VideoPart): VideoPoint {
  const { x, y, width, height } = part.mark;

  return {
    x: x + width / 2 + Math.min(width * 0.18, 24),
    y: y + height / 2 + Math.min(height * 0.2, 10),
  };
}
