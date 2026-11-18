// The video of a tutorial is composed, not recorded: the help page draws each frame from the
// stills of the steps and from the timeline below (web/src/features/help/video), so no load,
// scroll or dropped frame of a live session can reach it. The tool writes the stills and the
// timeline; the frame at second t is a function of them alone.
import { createHash } from "node:crypto";

import { VIEW } from "./app.mjs";

// Seconds of each part of a beat.
const TRAVEL = 0.9;
const HOLD_STEP = 1.7;
const HOLD_BRIDGE = 0.5;
const CLICK = 0.6;
const FADE = 0.3;
const END = 1.4;

// Tolerance of a sum of seconds written in binary floating point.
const EPSILON = 1e-9;

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
      mark: beat.mark,
      // The element the reader acts on, when the mark surrounds more than it.
      ...(beat.point ? { point: beat.point } : {}),
    };

    at = seconds(at + TRAVEL + hold + part.click);

    return part;
  });

  return { parts, duration: seconds(at + END), fade: FADE };
}

// A still is named by its content: two parts that show the same screen share one file.
export function stillName(tutorial, png) {
  const hash = createHash("sha256").update(png).digest("hex");

  return `${tutorial}/${hash.slice(0, 12)}.png`;
}

// The problems of a video entry of media.json, as the tool writes it: one still per part, parts
// that follow each other with the durations of this file, marks on the screen.
export function timelineProblems(what, video) {
  const problems = [];
  const parts = video.parts ?? [];
  const near = (a, b) => Math.abs(a - b) < EPSILON;
  let end = 0;

  if (video.stills?.length !== parts.length) {
    problems.push(`${what}: ${video.stills?.length ?? 0} stills for ${parts.length} parts`);
  }

  if (!near(video.fade, FADE)) problems.push(`${what}: fade is not ${FADE} s`);
  if (!video.accent) problems.push(`${what}: no accent`);

  for (const [index, part] of parts.entries()) {
    problems.push(...partProblems(`${what} part ${index + 1}`, part, end));
    end = part.start + part.travel + part.hold + part.click;
  }

  if (parts.length === 0 || !near(video.duration, end + END)) {
    problems.push(`${what}: duration is not the end of the last part plus ${END} s`);
  }

  return problems;
}

// A sum of the constants, rounded to the millisecond: 9.2 and not 9.200000000000001.
function seconds(value) {
  return Math.round(value * 1000) / 1000;
}

function partProblems(what, part, start) {
  const problems = [];
  const near = (a, b) => Math.abs(a - b) < EPSILON;
  const { x, y, width, height } = part.mark ?? {};

  if (!near(part.start, start)) problems.push(`${what}: does not start where the part before ends`);
  if (!near(part.travel, TRAVEL)) problems.push(`${what}: travel is not ${TRAVEL} s`);

  const hold = part.number > 0 ? HOLD_STEP : HOLD_BRIDGE;
  if (!near(part.hold, hold)) problems.push(`${what}: hold is not ${hold} s`);
  if (!near(part.click, 0) && !near(part.click, CLICK)) {
    problems.push(`${what}: click is neither 0 nor ${CLICK} s`);
  }

  const inside = x >= 0 && y >= 0 && x + width <= VIEW.width && y + height <= VIEW.height;
  if (!inside || !(width >= 1 && height >= 1)) problems.push(`${what}: the mark leaves the screen`);

  const point = part.point;
  if (
    point !== undefined &&
    !(point.x >= x && point.y >= y && point.x + point.width <= x + width && point.y + point.height <= y + height)
  ) {
    problems.push(`${what}: the point leaves the mark`);
  }

  return problems;
}
