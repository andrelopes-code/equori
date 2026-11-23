import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Autosaver } from "@/features/spreadsheets/model/autosaver";
import type { SaveStatus } from "@/features/spreadsheets/model/autosaver";

interface Pending {
  resolve: () => void;
  reject: (error: unknown) => void;
}

function setup() {
  const statuses: SaveStatus[] = [];
  const saves: Pending[] = [];
  const saver = new Autosaver({
    delay: 1000,
    save: () =>
      new Promise<void>((resolve, reject) => {
        saves.push({ resolve, reject });
      }),
    isConflict: (error) => error === "conflict",
    onStatus: (status) => statuses.push(status),
  });

  return { saver, statuses, saves };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Autosaver", () => {
  it("saves once after the pause that follows several changes", async () => {
    const { saver, statuses, saves } = setup();

    saver.touch();
    await vi.advanceTimersByTimeAsync(600);
    saver.touch();
    await vi.advanceTimersByTimeAsync(999);

    expect(saves).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);

    expect(saves).toHaveLength(1);

    saves[0]?.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(statuses).toEqual(["pending", "saving", "saved"]);
    expect(saver.dirty).toBe(false);
  });

  it("saves again a change made while a save runs", async () => {
    const { saver, statuses, saves } = setup();

    saver.touch();
    await vi.advanceTimersByTimeAsync(1000);
    saver.touch();
    saves[0]?.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(saves).toHaveLength(2);
    expect(saver.dirty).toBe(true);

    saves[1]?.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(statuses).toEqual(["pending", "saving", "saved"]);
  });

  it("flushes a waiting change without the pause", async () => {
    const { saver, saves } = setup();

    saver.touch();
    const flushed = saver.flush();

    expect(saves).toHaveLength(1);

    saves[0]?.resolve();
    await flushed;
    await vi.advanceTimersByTimeAsync(5000);

    expect(saves).toHaveLength(1);
    expect(saver.dirty).toBe(false);
  });

  it("saves nothing on a flush without a change", async () => {
    const { saver, saves } = setup();

    await saver.flush();

    expect(saves).toHaveLength(0);
  });

  it("retries a failed save on the next change", async () => {
    const { saver, statuses, saves } = setup();

    saver.touch();
    await vi.advanceTimersByTimeAsync(1000);
    saves[0]?.reject(new Error("offline"));
    await vi.advanceTimersByTimeAsync(0);

    expect(statuses.at(-1)).toBe("failed");

    saver.touch();
    await vi.advanceTimersByTimeAsync(1000);
    saves[1]?.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(statuses.at(-1)).toBe("saved");
  });

  it("stops saving after a conflict", async () => {
    const { saver, statuses, saves } = setup();

    saver.touch();
    await vi.advanceTimersByTimeAsync(1000);
    saves[0]?.reject("conflict");
    await vi.advanceTimersByTimeAsync(0);
    saver.touch();
    await vi.advanceTimersByTimeAsync(5000);
    await saver.flush();

    expect(statuses.at(-1)).toBe("conflict");
    expect(saves).toHaveLength(1);
  });

  it("saves nothing after dispose", async () => {
    const { saver, saves } = setup();

    saver.touch();
    saver.dispose();
    await vi.advanceTimersByTimeAsync(5000);

    expect(saves).toHaveLength(0);
  });
});
