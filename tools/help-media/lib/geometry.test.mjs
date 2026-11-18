import assert from "node:assert/strict";
import { test } from "node:test";

import { clipAround, markIn, markOnScreen, markProblems, percent } from "./geometry.mjs";

// The page region beside the navigation on the 1920 by 1200 screen.
const main = { x: 201, y: 10, width: 1719, height: 1180 };

test("a figure is centred on a frame that fits in it", () => {
  const dialog = { x: 735, y: 400, width: 450, height: 370 };
  const field = { x: 760, y: 500, width: 400, height: 56 };

  assert.deepEqual(clipAround(field, dialog), { x: 480, y: 285, width: 960, height: 600 });
});

test("a figure stays inside a frame larger than it", () => {
  const card = { x: 400, y: 218, width: 326, height: 205 };

  assert.equal(clipAround(card, main).x, 201);
});

test("a figure leaves its frame only by the room of a mark at the edge of the frame", () => {
  const card = { x: 201, y: 218, width: 326, height: 205 };

  // 36 px of room before the element, on a whole device pixel.
  assert.equal(clipAround(card, main).x, 165);
});

test("a figure stays inside the screen", () => {
  const button = { x: 1830, y: 52, width: 50, height: 34 };
  const clip = clipAround(button, main);

  assert.deepEqual([clip.x, clip.y], [960, 10]);
});

test("a figure is centred across a frame that fits in one direction only", () => {
  // A dialog 2 px taller than the figure: it is centred across, and held to the target down.
  const dialog = { x: 735, y: 399, width: 450, height: 602 };
  const button = { x: 1116, y: 965, width: 51, height: 28 };

  assert.deepEqual(clipAround(button, dialog), { x: 480, y: 429, width: 960, height: 600 });
});

test("the mark is the target grown by its pad, in percent of the figure", () => {
  const clip = { x: 480, y: 285, width: 960, height: 600 };
  const field = { x: 520, y: 400, width: 560, height: 56 };
  const mark = markIn(field, clip);

  assert.deepEqual(mark, { x: 28, y: 103, width: 584, height: 80 });
  assert.deepEqual(percent(mark), [2.92, 17.17, 60.83, 13.33]);
  assert.deepEqual(markProblems(field, clip, mark), []);
});

test("a target outside the figure is a failure, never a mark off its place", () => {
  const clip = { x: 0, y: 0, width: 960, height: 600 };
  const far = { x: 1000, y: 10, width: 40, height: 30 };

  assert.match(markProblems(far, clip, markIn(far, clip)).join(), /does not fit/);
});

test("a mark keeps the margin its number needs, as far as the edge of its element", () => {
  const clip = { x: 960, y: 0, width: 960, height: 600 };
  const inside = markIn({ x: 1870, y: 30, width: 26, height: 26 }, clip);
  const corner = markIn({ x: 1890, y: 4, width: 26, height: 26 }, clip);

  assert.deepEqual([inside.x + inside.width, inside.y], [936, 24]);
  // An element inside the margin: the mark stops at the element, never on it.
  assert.deepEqual([corner.x + corner.width, corner.y], [956, 4]);
});

test("a mark at the margin of the figure stays inside it after rounding", () => {
  // 87.625% and 8.375% each round up; their sum would pass the 96% the margin allows.
  const [, y, , height] = percent({ x: 100, y: 525.75, width: 80, height: 50.25 });

  assert.equal(y, 87.63);
  assert.ok(y + height <= 96, `${y} + ${height}`);
});

test("a figure leaves the mark its room around an element at the top of the page region", () => {
  // A button of the page header, 11 px under the top of the region: held inside the region, the
  // figure would start at the region and the mark would be pushed onto the button.
  const button = { x: 1790, y: 21, width: 100, height: 28 };
  const clip = clipAround(button, main);
  const mark = markIn(button, clip);

  assert.equal(clip.y, 0);
  assert.deepEqual(markProblems(button, clip, mark), []);
});

test("a mark held by the margin stops at the edge of its element", () => {
  const clip = { x: 960, y: 9, width: 960, height: 600 };
  const button = { x: 1790, y: 21, width: 100, height: 28 };
  const mark = markIn(button, clip);

  assert.equal(mark.y, 12);
  assert.deepEqual(markProblems(button, clip, mark), []);
});

test("the mark of the video is the element grown by its pad, whatever the figure", () => {
  const button = { x: 1790, y: 21, width: 100, height: 28 };

  assert.deepEqual(markOnScreen(button), { x: 1778, y: 9, width: 124, height: 52 });
  assert.deepEqual(markOnScreen({ x: 2, y: 3, width: 50, height: 20 }), { x: 0, y: 0, width: 64, height: 35 });
});
