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

// Workaround for Slotted issue #172: a page reads its box before any size report, and jsdom lays
// out nothing, so every page would hold the compact size class. A page's box takes the viewport.
function pageBox(this: Element): DOMRect {
  if (this.matches('[data-ui="page"]')) {
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }

  return elementBox.call(this);
}

// eslint-disable-next-line @typescript-eslint/unbound-method -- called with the element as this
const elementBox = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  // A test file under the node environment (request bodies Node builds itself) has no window.
  if (typeof window === "undefined") return;
  globalThis.ResizeObserver = NoopResizeObserver;
  globalThis.IntersectionObserver = VisibleIntersectionObserver;
  // jsdom does not implement scrollTo; the router restores scroll on navigation.
  window.scrollTo = () => undefined;
  Element.prototype.getBoundingClientRect = pageBox;
  setViewport(1280);
});

afterEach(() => {
  cleanup();
});
