import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chooseKind } from "@/features/accounts/kind-chooser/kind-transition";

describe("chooseKind", () => {
  let from: HTMLElement;
  let stale: HTMLElement;
  const choose = vi.fn();
  const start = vi.fn((options: StartViewTransitionOptions) => {
    expect(from).toHaveAttribute("data-hero-name");
    expect(stale).not.toHaveAttribute("data-hero-name");

    return { updateCallbackDone: Promise.resolve(options.update?.()) };
  });

  beforeEach(() => {
    from = document.createElement("div");
    stale = document.createElement("div");
    stale.setAttribute("data-hero-name", "");
    document.body.append(from, stale);
    choose.mockClear();
    start.mockClear();
  });

  afterEach(() => {
    from.remove();
    stale.remove();
    Reflect.deleteProperty(document, "startViewTransition");
    vi.unstubAllGlobals();
  });

  it("runs the choice inside a transition of type kind", () => {
    support({ reduce: false });

    chooseKind(choose, from);

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]?.[0]?.types).toEqual(["kind"]);
    expect(choose).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveAttribute("data-hero-name");
  });

  it("chooses with no transition when the browser has none", () => {
    stubMotion({ reduce: false });

    chooseKind(choose, from);

    expect(choose).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveAttribute("data-hero-name");
  });

  it("chooses with no transition under reduced motion", () => {
    support({ reduce: true });

    chooseKind(choose, from);

    expect(start).not.toHaveBeenCalled();
    expect(choose).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveAttribute("data-hero-name");
  });

  it("chooses with no transition when there is no element to travel", () => {
    support({ reduce: false });

    chooseKind(choose, null);

    expect(start).not.toHaveBeenCalled();
    expect(choose).toHaveBeenCalledTimes(1);
  });

  function support({ reduce }: { reduce: boolean }) {
    Object.assign(document, { startViewTransition: start });
    stubMotion({ reduce });
  }

  function stubMotion({ reduce }: { reduce: boolean }) {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: reduce && query.includes("prefers-reduced-motion"),
        }) as MediaQueryList,
    );
  }
});
