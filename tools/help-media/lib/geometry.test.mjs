import assert from "node:assert/strict";
import { test } from "node:test";

import { clipAround, markIn, markProblems, percent } from "./geometry.mjs";

const main = { x: 234, y: 0, width: 1046, height: 800 };

test("a figure is centred on a frame that fits in it", () => {
  const dialog = { x: 338, y: 215, width: 604, height: 370 };
  const field = { x: 360, y: 300, width: 560, height: 56 };

  assert.deepEqual(clipAround(field, dialog), { x: 320, y: 200, width: 640, height: 400 });
});

test("a figure stays inside a frame larger than it", () => {
  const card = { x: 234, y: 218, width: 326, height: 205 };

  assert.equal(clipAround(card, main).x, 234);
});

test("a figure stays inside the screen", () => {
  const button = { x: 1190, y: 52, width: 50, height: 34 };
  const clip = clipAround(button, main);

  assert.deepEqual([clip.x, clip.y], [640, 0]);
});

test("the mark is the target grown by its pad, in percent of the figure", () => {
  const clip = { x: 320, y: 200, width: 640, height: 400 };
  const field = { x: 360, y: 300, width: 560, height: 56 };
  const mark = markIn(field, clip);

  assert.deepEqual(mark, { x: 34, y: 94, width: 572, height: 68 });
  assert.deepEqual(percent(mark), [5.31, 23.5, 89.38, 17]);
  assert.deepEqual(markProblems(field, clip, mark), []);
});

test("a target outside the figure is a failure, never a mark off its place", () => {
  const clip = { x: 0, y: 0, width: 640, height: 400 };
  const far = { x: 700, y: 10, width: 40, height: 30 };

  assert.match(markProblems(far, clip, markIn(far, clip)).join(), /does not fit/);
});

test("a mark keeps the margin its number needs at the edge of the figure", () => {
  const clip = { x: 640, y: 0, width: 640, height: 400 };
  const corner = { x: 1250, y: 4, width: 26, height: 26 };
  const mark = markIn(corner, clip);

  assert.equal(mark.x + mark.width, 624);
  assert.equal(mark.y, 16);
});
