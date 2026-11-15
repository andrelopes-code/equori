import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingDock } from "@/features/assistant/panel/pending-dock";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

// Spec 2026-11-15 section 6: the dock keeps the pending decisions in reach.
describe("PendingDock", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", StubObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    StubObserver.instances = [];
  });

  it("hides while a sheet footer is in view", () => {
    renderFeed(1);
    const footer = footerAt(0);

    show(footer, false);
    expect(
      screen.getByText("1 sheet awaits your decision"),
    ).toBeInTheDocument();

    show(footer, true);
    expect(
      screen.queryByText("1 sheet awaits your decision"),
    ).not.toBeInTheDocument();
  });

  it("shows the count when every footer is out of view", () => {
    renderFeed(2);

    footers().forEach((footer) => {
      show(footer, false);
    });

    expect(
      screen.getByText("2 sheets await your decision"),
    ).toBeInTheDocument();
  });

  it("scrolls to the first open sheet", async () => {
    renderFeed(2);
    const first = sheetAt(0);
    const second = sheetAt(1);
    const scrollFirst = vi.fn();
    const scrollSecond = vi.fn();
    first.scrollIntoView = scrollFirst;
    second.scrollIntoView = scrollSecond;
    footers().forEach((footer) => {
      show(footer, false);
    });

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(scrollFirst).toHaveBeenCalledExactlyOnceWith({
      block: "center",
    });
    expect(scrollSecond).not.toHaveBeenCalled();
  });

  it("draws nothing without open sheets", () => {
    renderFeed(0);

    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    expect(screen.queryByText(/await/)).toBeNull();
  });
});

interface FeedProps {
  sheets: number;
}

// The dock beside a feed whose sheets each carry the markers the dock observes.
function Feed({ sheets }: FeedProps) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  return (
    <div>
      <div ref={setRoot} data-testid="feed">
        {Array.from({ length: sheets }, (_, i) => (
          <section key={i} data-open-sheet="">
            <div data-sheet-footer="" />
          </section>
        ))}
      </div>

      <PendingDock scrollRoot={root} />
    </div>
  );
}

// jsdom has no IntersectionObserver: the stub records each instance and lets a test fire entries.
class StubObserver {
  static instances: StubObserver[] = [];

  private targets = new Set<Element>();

  constructor(private callback: IntersectionObserverCallback) {
    StubObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  takeRecords() {
    return [];
  }

  fire(target: Element, isIntersecting: boolean) {
    if (!this.targets.has(target)) return;

    this.callback(
      [{ target, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function renderFeed(count: number) {
  renderWithProviders(<Feed sheets={count} />, { fetch: fakeApi({}) });
}

function sheetAt(index: number): HTMLElement {
  return elementAt("[data-open-sheet]", index);
}

function footers(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-sheet-footer]"),
  );
}

function footerAt(index: number): HTMLElement {
  return elementAt("[data-sheet-footer]", index);
}

function elementAt(selector: string, index: number): HTMLElement {
  const found = document.querySelectorAll<HTMLElement>(selector)[index];
  if (found === undefined)
    throw new Error(`no ${selector} at ${String(index)}`);

  return found;
}

function show(footer: Element, isIntersecting: boolean) {
  act(() => {
    StubObserver.instances.forEach((observer) => {
      observer.fire(footer, isIntersecting);
    });
  });
}
