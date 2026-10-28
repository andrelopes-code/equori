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

// jsdom lays nothing out, so every observed element counts as in view: the data-grid asks for its
// next page when the sentinel after its rows comes into view, as it does on a page shorter than the
// screen.
class VisibleIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  #callback: IntersectionObserverCallback;
  #connected = true;

  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    const rect = new DOMRect();
    queueMicrotask(() => {
      if (!this.#connected) return;
      this.#callback(
        [
          {
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: rect,
            intersectionRect: rect,
            rootBounds: null,
            time: 0,
          },
        ],
        this,
      );
    });
  }

  unobserve(): void {
    return undefined;
  }

  disconnect(): void {
    this.#connected = false;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

// A page renders its regions after its requests answer; on a loaded machine that takes longer than
// Testing Library's one second, so a find waits up to four within the 15 s test timeout.
configure({ asyncUtilTimeout: 4000 });

const seeds = [
  "--slotted-seed-accent",
  "--slotted-seed-neutral",
  "--slotted-seed-success",
  "--slotted-seed-info",
  "--slotted-seed-warning",
  "--slotted-seed-danger",
];

beforeEach(() => {
  // A test file under the node environment (request bodies Node builds itself) has no window.
  if (typeof window === "undefined") return;
  globalThis.ResizeObserver = NoopResizeObserver;
  globalThis.IntersectionObserver = VisibleIntersectionObserver;
  // jsdom does not implement scrollTo; the router restores scroll on navigation.
  window.scrollTo = () => undefined;
  setViewport(1280);
  // jsdom 30 resolves a custom property that no ancestor declares by walking the chain again
  // from every ancestor, which doubles the cost with each level: a portal opened from a cell of
  // a table read its six seeds in 34 s. Declared on the root, the walk stops there.
  // Workaround for Slotted finding "A portal reads its seeds from the opener's computed style on every open":
  // the tests load no theme, so nothing declares the seeds.
  for (const seed of seeds)
    document.documentElement.style.setProperty(seed, "none");
});

afterEach(() => {
  cleanup();
});
