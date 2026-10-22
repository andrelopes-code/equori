import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { setViewport } from "@/testing/viewport";

// jsdom does not implement ResizeObserver; the chart measures its container with one. Layout is never asserted.
class NoopResizeObserver implements ResizeObserver {
  observe(): void {
    return undefined;
  }

  unobserve(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }
}

// A page renders its regions after its requests answer; on a loaded machine that takes longer than
// Testing Library's one second, so a find waits up to four within the 15 s test timeout.
configure({ asyncUtilTimeout: 4000 });

beforeEach(() => {
  // A test file under the node environment (request bodies Node builds itself) has no window.
  if (typeof window === "undefined") return;
  globalThis.ResizeObserver = NoopResizeObserver;
  // jsdom does not implement scrollTo; the router restores scroll on navigation.
  window.scrollTo = () => undefined;
  setViewport(1280);
});

afterEach(() => {
  cleanup();
});
