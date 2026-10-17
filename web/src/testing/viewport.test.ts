import { describe, expect, it, vi } from "vitest";

import { setViewport } from "@/testing/viewport";

describe("setViewport", () => {
  it("evaluates min-width and max-width queries against the width", () => {
    setViewport(360);
    expect(window.innerWidth).toBe(360);
    expect(window.matchMedia("(min-width: 600px)").matches).toBe(false);
    expect(window.matchMedia("(max-width: 600px)").matches).toBe(true);
    expect(window.matchMedia("(min-width: 360px)").matches).toBe(true);

    setViewport(768);
    expect(window.innerWidth).toBe(768);
    expect(window.matchMedia("(min-width: 600px)").matches).toBe(true);
    expect(window.matchMedia("(max-width: 600px)").matches).toBe(false);
  });

  it("fires one change event on a listener whose result changed", () => {
    setViewport(360);
    const query = window.matchMedia("(min-width: 600px)");
    const listener = vi.fn();
    query.addEventListener("change", listener);

    setViewport(768);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      matches: true,
      media: "(min-width: 600px)",
    });
    expect(query.matches).toBe(true);
  });

  it("does not fire change when the result is unchanged", () => {
    setViewport(360);
    const query = window.matchMedia("(min-width: 600px)");
    const listener = vi.fn();
    query.addEventListener("change", listener);

    setViewport(400);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops firing after removeEventListener", () => {
    setViewport(360);
    const query = window.matchMedia("(min-width: 600px)");
    const listener = vi.fn();
    query.addEventListener("change", listener);
    query.removeEventListener("change", listener);

    setViewport(768);

    expect(listener).not.toHaveBeenCalled();
  });
});
