// Where a figure is cut and where its mark sits: both come from the boxes the browser reports
// for the elements of the step, never from a number typed by hand.
import { VIEW } from "./app.mjs";

// Every figure is this window of the page, in CSS pixels, never scaled: text keeps its size.
export const CLIP = { width: 640, height: 400 };
// The number of a mark is a 21 px circle centred on its corner; this margin keeps it whole.
export const MARGIN = 16;
// The mark stands this far from the element it points at.
const PAD = 6;

export function union(boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));

  return { x, y, width: right - x, height: bottom - y };
}

// The window of a figure, placed in each direction on its own. Where the frame fits in the figure
// (a dialog), the window is centred on the frame. Where it does not (the page beside the
// navigation), the window is centred on the target and held inside the frame, so no figure shows
// a slice of a neighbouring region. It is always inside the screen.
export function clipAround(target, frame) {
  return {
    x: along(target.x, target.width, frame?.x, frame?.width, CLIP.width, VIEW.width),
    y: along(target.y, target.height, frame?.y, frame?.height, CLIP.height, VIEW.height),
    ...CLIP,
  };
}

function along(targetStart, targetSize, frameStart, frameSize, clip, view) {
  const hold = (value, low, high) => Math.round(Math.max(low, Math.min(Math.max(low, high), value)));
  const centred = (start, size) => start + size / 2 - clip / 2;

  if (frameStart === undefined) return hold(centred(targetStart, targetSize), 0, view - clip);
  if (frameSize <= clip) return hold(centred(frameStart, frameSize), 0, view - clip);

  const low = Math.max(0, frameStart);
  const high = Math.min(view, frameStart + frameSize) - clip;

  return hold(centred(targetStart, targetSize), low, high);
}

// The width to ask of the page region so that its box, borders included, is as wide as a figure:
// a figure then spans the region and never shows a slice of the page's width.
export function regionWidth(measured) {
  return CLIP.width - (measured - CLIP.width);
}

// The mark in CSS pixels of the clip, grown by the pad and held inside the margin.
export function markIn(target, clip) {
  const left = Math.max(MARGIN, target.x - clip.x - PAD);
  const top = Math.max(MARGIN, target.y - clip.y - PAD);
  const right = Math.min(clip.width - MARGIN, target.x - clip.x + target.width + PAD);
  const bottom = Math.min(clip.height - MARGIN, target.y - clip.y + target.height + PAD);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

// The failures that would draw a wrong mark: a target outside the clip, a mark too small to
// see or so large that it marks nothing.
export function markProblems(target, clip, mark) {
  const problems = [];
  const inside =
    target.x >= clip.x &&
    target.y >= clip.y &&
    target.x + target.width <= clip.x + clip.width &&
    target.y + target.height <= clip.y + clip.height;

  if (!inside) problems.push("the target does not fit in the figure");
  if (mark.width < 24 || mark.height < 24) problems.push("the mark is smaller than 24 px");
  if (mark.width * mark.height > 0.7 * clip.width * clip.height) {
    problems.push("the mark covers more than 70% of the figure");
  }

  return problems;
}

// Percent of the figure, two decimals: what the page positions the mark with. Each side is
// rounded on its own and the size is their difference, so a mark at the margin stays inside it.
export function percent(mark) {
  const round = (value) => Math.round(value * 100) / 100;
  const side = (value, whole) => round((value / whole) * 100);
  const left = side(mark.x, CLIP.width);
  const top = side(mark.y, CLIP.height);

  return [
    left,
    top,
    round(side(mark.x + mark.width, CLIP.width) - left),
    round(side(mark.y + mark.height, CLIP.height) - top),
  ];
}
