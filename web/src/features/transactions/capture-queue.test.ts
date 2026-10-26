import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QueueWriteError,
  enqueueCapture,
  findQueued,
  readQueue,
  removeQueued,
} from "@/features/transactions/capture-queue";

const entry = (userId: number, text: string) => ({
  userId,
  text,
  defaultAccountId: null,
  capturedOn: "2026-10-18",
});

describe("capture queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the entries of one user, oldest first", () => {
    const first = enqueueCapture(
      entry(7, "mercado 30 ontem"),
      new Date("2026-10-18T10:00:00Z"),
    );
    enqueueCapture(
      entry(8, "other user's text"),
      new Date("2026-10-18T10:01:00Z"),
    );
    const second = enqueueCapture(
      entry(7, "uber 12"),
      new Date("2026-10-18T10:02:00Z"),
    );
    expect(readQueue(7).map((e) => e.id)).toEqual([first.id, second.id]);
    expect(readQueue(8)).toHaveLength(1);
    expect(first.createdAt).toBe("2026-10-18T10:00:00.000Z");
  });

  it("finds and removes one entry", () => {
    const queued = enqueueCapture(entry(7, "uber 12"));
    expect(findQueued(queued.id)?.text).toBe("uber 12");
    removeQueued(queued.id);
    expect(findQueued(queued.id)).toBeUndefined();
    expect(readQueue(7)).toEqual([]);
  });

  it("throws when the device refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => enqueueCapture(entry(7, "uber 12"))).toThrow(QueueWriteError);
  });

  it("skips stored entries of another shape", () => {
    localStorage.setItem(
      "equori.capture.queue",
      JSON.stringify([
        { id: "x" },
        {
          id: "y",
          userId: 7,
          text: "ok",
          defaultAccountId: null,
          capturedOn: "2026-10-18",
          createdAt: "2026-10-18T10:00:00.000Z",
        },
      ]),
    );
    expect(readQueue(7).map((e) => e.id)).toEqual(["y"]);
  });

  it("asks the browser to keep its storage on the first entry", () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal("navigator", { storage: { persist } });
    enqueueCapture(entry(7, "uber 12"));
    expect(persist).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
