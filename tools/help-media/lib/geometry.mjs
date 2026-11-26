// Where a figure is cut and where its mark sits: both come from the boxes the browser reports
// for the elements of the step, never from a number typed by hand.
import { VIEW } from "./screen.mjs";

// Every figure is this window of the screen, in CSS pixels: half the width of the screen. The
// page draws it at two thirds of its size, from three device pixels for each of its own; the
// layout it shows is the one of the whole screen.
export const CLIP = { width: 960, height: 600 };
// A figure is drawn at two thirds of its size, so 3 px here are 2 px on the page.
// The window of a figure leaves this room around the mark of its element when the screen allows
// it: the number of a mark is a 21 px circle of the page centred on its corner, 32 px here.
export const MARGIN = 24;
// The outline of a mark, 2 px on the page: a mark stands at least this far inside its figure. Its
// number moves inside the figure on its own (help.module.css, .spotNumber).
const EDGE = 3;
// The mark stands this far from the element it points at: 8 px on the page, which keeps most
// of the number clear of a label at the corner of the element.
const PAD = 12;

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
  const between = (value, low, high) => Math.max(low, Math.min(Math.max(low, high), value));
  const centred = (start, size) => start + size / 2 - clip / 2;
  // The room of the mark: its pad and its margin on each side of the element. It comes before
  // the frame, so a mark is never pushed onto the element it surrounds.
  const room = PAD + MARGIN;
  const roomy = (value) => between(value, targetStart + targetSize + room - clip, targetStart - room);
  const whole = (value) => Math.round(between(value, 0, view - clip));

  if (frameStart === undefined) return whole(centred(targetStart, targetSize));
  if (frameSize <= clip) return whole(roomy(centred(frameStart, frameSize)));

  const low = Math.max(0, frameStart);
  const high = Math.min(view, frameStart + frameSize) - clip;

  return whole(roomy(between(centred(targetStart, targetSize), low, high)));
}

// The mark in CSS pixels of the clip: the element grown by the pad. Near the edge of the figure,
// or near the content beside the element (room: the free distance to it), the pad shrinks on every
// side alike: the mark keeps one distance from its element, never stands on it (owner, 2026-11-19)
// and never crosses its neighbour.
export function markIn(target, clip, room = Infinity) {
  const x = target.x - clip.x;
  const y = target.y - clip.y;
  const pad = Math.min(
    padWithin(x, target.width, EDGE, clip.width - EDGE),
    padWithin(y, target.height, EDGE, clip.height - EDGE),
    padInRoom(room),
  );

  return grown({ x, y, width: target.width, height: target.height }, pad);
}

// The mark of the video: the element grown by its pad on the whole screen. No window of a
// figure bounds it; the edge of the screen holds the pad as the margin holds a figure's.
export function markOnScreen(target, room = Infinity) {
  const pad = Math.min(
    padWithin(target.x, target.width, 0, VIEW.width),
    padWithin(target.y, target.height, 0, VIEW.height),
    padInRoom(room),
  );

  return grown(target, pad);
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
  // A mark held by the margin stands on its element instead of around it.
  const around = mark.x <= target.x - clip.x && mark.y <= target.y - clip.y;
  const beyond =
    mark.x + mark.width >= target.x - clip.x + target.width &&
    mark.y + mark.height >= target.y - clip.y + target.height;
  if (inside && !(around && beyond)) problems.push("the mark does not surround the target");
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

// The pad an element can take on both of its sides between two bounds of one axis.
function padWithin(start, size, low, high) {
  return Math.max(0, Math.min(PAD, start - low, high - (start + size)));
}

// The pad that leaves the outline one pixel short of the content beside the element.
function padInRoom(room) {
  return Math.max(0, Math.min(PAD, Math.floor(room) - 1));
}

function grown(box, pad) {
  return { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad };
}
