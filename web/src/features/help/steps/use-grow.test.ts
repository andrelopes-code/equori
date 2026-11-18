import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fadeAside,
  growFrames,
  shrinkTo,
} from "@/features/help/steps/use-grow";

const origin = new DOMRect(100, 200, 320, 200);
const own = new DOMRect(40, 50, 1280, 800);

function panel(finished: Promise<void>) {
  const animate = vi.fn(() => ({ finished }));
  const element = { animate, getBoundingClientRect: () => own };

  return { animate, element: element as unknown as HTMLElement };
}

function motion(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the player's travel", () => {
  it("starts over the element the reader pressed and ends in its own place", () => {
    expect(growFrames(own, origin)).toEqual([
      { transform: "translate(-420px, -150px) scale(0.25)", opacity: 0.6 },
      { transform: "none", opacity: 1 },
    ]);
  });

  it("travels back to that element before the player closes", async () => {
    motion(false);
    let arrive: () => void = () => undefined;
    const { animate, element } = panel(
      new Promise<void>((resolve) => {
        arrive = resolve;
      }),
    );
    const closed = vi.fn();

    const leaving = shrinkTo(element, origin).then(closed);
    await Promise.resolve();

    expect(animate).toHaveBeenCalledWith(
      [...growFrames(own, origin)].reverse(),
      expect.objectContaining({ fill: "forwards" }),
    );
    expect(closed).not.toHaveBeenCalled();

    arrive();
    await leaving;

    expect(closed).toHaveBeenCalledOnce();
  });

  it("closes at once under reduced motion", async () => {
    motion(true);
    const { animate, element } = panel(new Promise<void>(() => undefined));

    await shrinkTo(element, origin);

    expect(animate).not.toHaveBeenCalled();
  });

  it("closes at once without a place to return to", async () => {
    motion(false);
    const { animate, element } = panel(new Promise<void>(() => undefined));

    await shrinkTo(element, null);

    expect(animate).not.toHaveBeenCalled();
  });

  // Owner, 2026-11-19: the video travelled back under the steps, which stood still over it.
  it("fades the steps out before the player travels back, and waits for both", async () => {
    motion(false);
    let arrive: () => void = () => undefined;
    const { animate: travel, element } = panel(
      new Promise<void>((resolve) => {
        arrive = resolve;
      }),
    );
    const steps = panel(Promise.resolve());
    const closed = vi.fn();

    const leaving = shrinkTo(element, origin, [steps.element]).then(closed);
    await Promise.resolve();

    expect(travel).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(travel).toHaveBeenCalledOnce();
    });
    expect(steps.animate).toHaveBeenCalledWith(
      [{ opacity: 1 }, { opacity: 0 }],
      expect.objectContaining({ fill: "forwards" }),
    );
    expect(closed).not.toHaveBeenCalled();

    arrive();
    await leaving;

    expect(closed).toHaveBeenCalledOnce();
  });
});

describe("the steps beside the player", () => {
  it("appear once the player has grown to its place", () => {
    motion(false);
    const steps = panel(Promise.resolve());

    void fadeAside(steps.element, "in");

    expect(steps.animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ delay: expect.any(Number) as number }),
    );
  });

  it("stand still under reduced motion", () => {
    motion(true);
    const steps = panel(Promise.resolve());

    void fadeAside(steps.element, "in");

    expect(steps.animate).not.toHaveBeenCalled();
  });
});
