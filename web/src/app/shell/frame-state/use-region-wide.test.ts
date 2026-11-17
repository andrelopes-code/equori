import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRegionWide } from "@/app/shell/frame-state/use-region-wide";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRegionWide", () => {
  it("follows the width of the region across 1024 px", () => {
    const region = document.createElement("main");
    const resize = observeWidths(region);

    const { result } = renderHook(() => useRegionWide({ current: region }));

    expect(result.current).toBe(true);

    act(() => {
      resize(676);
    });
    expect(result.current).toBe(false);

    act(() => {
      resize(1024);
    });
    expect(result.current).toBe(true);
  });
});

// Replaces ResizeObserver with one the test fires, and returns the function that gives the
// region a width and fires it.
function observeWidths(region: HTMLElement): (width: number) => void {
  let notify: (() => void) | undefined;

  vi.stubGlobal(
    "ResizeObserver",
    class extends ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        notify = () => {
          callback([], this);
        };
      }
    },
  );

  return (width) => {
    region.getBoundingClientRect = () => new DOMRect(0, 0, width, 0);
    notify?.();
  };
}
