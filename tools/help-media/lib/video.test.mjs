import assert from "node:assert/strict";
import { test } from "node:test";

import { stillName, timeline, timelineProblems } from "./video.mjs";

const mark = { x: 100, y: 200, width: 300, height: 40 };
const beats = [
  { figure: "a", inVideo: true, clicks: true, mark },
  { inVideo: true, clicks: true, mark },
  { figure: "b", inVideo: false, clicks: false, mark },
  { figure: "c", inVideo: true, clicks: false, mark },
];

test("the timeline holds the beats of the video in order, numbered by figure", () => {
  const line = timeline(beats);

  assert.deepEqual(
    line.parts.map(({ start, hold, click, number }) => [start, hold, click, number]),
    [
      [0, 1.7, 0.6, 1],
      [3.2, 0.5, 0.6, 0],
      [5.2, 1.7, 0, 2],
    ],
  );
  assert.equal(line.duration, 9.2);
  assert.equal(line.fade, 0.3);
});

test("a still is named by the first 12 digits of its SHA-256", () => {
  assert.equal(stillName("pay-statement", Buffer.from("x")), "pay-statement/2d711642b726.png");
});

test("a sound timeline has no problem", () => {
  const line = timeline(beats);
  const video = { ...line, stills: ["t/a.png", "t/b.png", "t/a.png"], accent: "rgb(1, 2, 3)" };

  assert.deepEqual(timelineProblems("t pt", video), []);
});

test("a timeline that the tool did not write is refused", () => {
  const line = timeline(beats);
  const cases = [
    [{ stills: ["t/a.png"] }, "t pt: 1 stills for 3 parts"],
    [{ fade: 0.5 }, "t pt: fade is not 0.3 s"],
    [{ duration: 9 }, "t pt: duration is not the end of the last part plus 1.4 s"],
    [{ accent: "" }, "t pt: no accent"],
    [{ parts: [{ ...line.parts[0], start: 1 }, ...line.parts.slice(1)] }, "t pt part 1: does not start where the part before ends"],
    [{ parts: [{ ...line.parts[0], hold: 1 }, ...line.parts.slice(1)] }, "t pt part 1: hold is not 1.7 s"],
    [{ parts: [{ ...line.parts[0], travel: 1 }, ...line.parts.slice(1)] }, "t pt part 1: travel is not 0.9 s"],
    [{ parts: [{ ...line.parts[0], click: 0.2 }, ...line.parts.slice(1)] }, "t pt part 1: click is neither 0 nor 0.6 s"],
    [
      { parts: [{ ...line.parts[0], mark: { ...mark, x: 1900 } }, ...line.parts.slice(1)] },
      "t pt part 1: the mark leaves the screen",
    ],
  ];

  for (const [change, problem] of cases) {
    const video = { ...line, stills: ["t/a.png", "t/b.png", "t/a.png"], accent: "rgb(1, 2, 3)", ...change };

    assert.ok(timelineProblems("t pt", video).includes(problem), problem);
  }
});
