import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyVisual,
  readVisual,
  restoreVisual,
  useGlass,
} from "@/theme/visual";

const html = document.documentElement;

describe("visual", () => {
  beforeEach(() => {
    localStorage.clear();
    html.setAttribute("data-slotted-theme", "equori");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the standard style when storage is empty", () => {
    expect(readVisual()).toBe("standard");
  });

  it("returns the stored style", () => {
    localStorage.setItem("equori.visual", "glass");
    expect(readVisual()).toBe("glass");
  });

  it("returns the standard style for an unknown stored value", () => {
    localStorage.setItem("equori.visual", "neon");
    expect(readVisual()).toBe("standard");
  });

  it("returns the standard style when reading storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(readVisual()).toBe("standard");
  });

  it("stores the glass style and switches the theme once its stylesheet has loaded", async () => {
    applyVisual("glass");
    expect(localStorage.getItem("equori.visual")).toBe("glass");
    await vi.waitFor(() => {
      expect(html.getAttribute("data-slotted-theme")).toBe("equori-glass");
    });
  });

  it("returns to the standard theme when the glass style is turned off", async () => {
    applyVisual("glass");
    await vi.waitFor(() => {
      expect(html.getAttribute("data-slotted-theme")).toBe("equori-glass");
    });
    applyVisual("standard");
    await vi.waitFor(() => {
      expect(html.getAttribute("data-slotted-theme")).toBe("equori");
    });
    expect(localStorage.getItem("equori.visual")).toBe("standard");
  });

  it("restores the stored glass style at start", async () => {
    localStorage.setItem("equori.visual", "glass");
    restoreVisual();
    await vi.waitFor(() => {
      expect(html.getAttribute("data-slotted-theme")).toBe("equori-glass");
    });
  });

  it("leaves the theme alone at start when the style is standard", () => {
    restoreVisual();
    expect(html.getAttribute("data-slotted-theme")).toBe("equori");
  });

  it("draws the glass when the system scheme resolves to dark", () => {
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) => {
      const list = real(query);
      if (query === "(prefers-color-scheme: dark)")
        Object.defineProperty(list, "matches", { value: true });
      return list;
    });
    localStorage.setItem("equori.visual", "glass");
    localStorage.setItem("equori.scheme", "system");
    expect(renderHook(() => useGlass()).result.current).toBe(true);
  });
});
