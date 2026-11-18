import { describe, expect, it } from "vitest";

import {
  frameAt,
  partAt,
  restingAt,
  stepFrom,
} from "@/features/help/video/compose-frame";
import type { VideoTimeline } from "@/features/help/video/compose-frame";

const first = { x: 100, y: 200, width: 300, height: 40 };
const second = { x: 1000, y: 600, width: 100, height: 100 };

// Two parts as tools/help-media writes them: a numbered step with a click, then a bridge.
const line: VideoTimeline = {
  parts: [
    { start: 0, travel: 0.9, hold: 1.7, click: 0.6, number: 1, mark: first },
    { start: 3.2, travel: 0.9, hold: 0.5, click: 0, number: 0, mark: second },
  ],
  duration: 6,
  fade: 0.3,
};

// Where the pointer rests: below and after the centre of the mark.
const restFirst = { x: 100 + 150 + 24, y: 200 + 20 + 8 };
const restSecond = { x: 1000 + 50 + 18, y: 600 + 50 + 10 };

describe("the frame of the help video at a second", () => {
  it("starts with the pointer low in the middle of the screen, on the first still", () => {
    const frame = frameAt(line, 0);

    expect(frame.still).toBe(0);
    expect(frame.under).toBeUndefined();
    expect(frame.pointer).toEqual({ x: 960, y: 960 });
    expect(frame.markOpacity).toBe(0);
    expect(frame.click).toBe(-1);
    expect(frame.press).toBe(1);
  });

  it("moves the pointer along an eased path during the travel", () => {
    const frame = frameAt(line, 0.45);

    expect(frame.pointer.x).toBeCloseTo((960 + restFirst.x) / 2, 6);
    expect(frame.pointer.y).toBeCloseTo((960 + restFirst.y) / 2, 6);
    expect(frame.markOpacity).toBe(0);
  });

  it("draws the mark in a quarter of a second once the pointer rests", () => {
    expect(frameAt(line, 0.9 + 0.125).markOpacity).toBeCloseTo(0.5, 6);
    expect(frameAt(line, 2).markOpacity).toBe(1);
    expect(frameAt(line, 2).pointer).toEqual(restFirst);
    expect(frameAt(line, 2).number).toBe(1);
  });

  it("opens the ring of the click after the hold and presses the pointer", () => {
    const frame = frameAt(line, 0.9 + 1.7 + 0.3);

    expect(frame.click).toBeCloseTo(0.5, 6);
    expect(frame.press).toBeCloseTo(1 - 0.2 * Math.sin(Math.PI * 0.9), 6);
  });

  it("fades the next still over the one before it", () => {
    const frame = frameAt(line, 3.2 + 0.15);

    expect(frame.still).toBe(1);
    expect(frame.under).toBe(0);
    expect(frame.fade).toBeCloseTo(0.5, 6);
    expect(frameAt(line, 3.2 + 0.31).under).toBeUndefined();
  });

  it("travels from the rest of the part before", () => {
    expect(frameAt(line, 3.2).pointer).toEqual(restFirst);
    expect(frameAt(line, 5).pointer).toEqual(restSecond);
  });

  it("keeps the last part after its end", () => {
    const frame = frameAt(line, 6);

    expect(frame.still).toBe(1);
    expect(frame.click).toBe(-1);
    expect(frame.markOpacity).toBe(1);
  });
});

describe("the parts of the help video", () => {
  it("finds the part a second falls in", () => {
    expect(partAt(line, -1)).toBe(0);
    expect(partAt(line, 3.19)).toBe(0);
    expect(partAt(line, 3.2)).toBe(1);
    expect(partAt(line, 6)).toBe(1);
  });

  it("rests each part with the pointer on its mark and the mark whole", () => {
    expect(restingAt(line, 0.1)).toBeCloseTo(1.75, 9);
    expect(restingAt(line, 4)).toBeCloseTo(4.35, 9);

    const frame = frameAt(line, restingAt(line, 0.1));
    expect(frame.markOpacity).toBe(1);
    expect(frame.click).toBe(-1);
  });

  it("steps to the start of the next or previous part, within the video", () => {
    expect(stepFrom(line, 1, 1)).toBe(3.2);
    expect(stepFrom(line, 4, 1)).toBe(6);
    expect(stepFrom(line, 4, -1)).toBe(3.2);
    expect(stepFrom(line, 3.2, -1)).toBe(0);
    expect(stepFrom(line, 1, -1)).toBe(0);
  });
});
