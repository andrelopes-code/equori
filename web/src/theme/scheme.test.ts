import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyScheme, readScheme } from "@/theme/scheme";

function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: prefersDark && query === "(prefers-color-scheme: dark)",
    })),
  );
}

describe("scheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-slotted-scheme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("defaults to dark when storage is empty", () => {
    expect(readScheme()).toBe("dark");
  });

  it("returns the stored scheme", () => {
    localStorage.setItem("equori.scheme", "system");
    expect(readScheme()).toBe("system");
  });

  it("returns dark for an unknown stored value", () => {
    localStorage.setItem("equori.scheme", "sepia");
    expect(readScheme()).toBe("dark");
  });

  it("returns dark when reading storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(readScheme()).toBe("dark");
  });

  it("applies light to the root element and storage", () => {
    applyScheme("light");
    expect(document.documentElement.getAttribute("data-slotted-scheme")).toBe(
      "light",
    );
    expect(localStorage.getItem("equori.scheme")).toBe("light");
  });

  it("resolves system to dark when the device prefers dark", () => {
    stubMatchMedia(true);
    applyScheme("system");
    expect(document.documentElement.getAttribute("data-slotted-scheme")).toBe(
      "dark",
    );
    expect(localStorage.getItem("equori.scheme")).toBe("system");
  });

  it("resolves system to light when the device prefers light", () => {
    stubMatchMedia(false);
    applyScheme("system");
    expect(document.documentElement.getAttribute("data-slotted-scheme")).toBe(
      "light",
    );
  });

  it("still sets the attribute when writing storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    applyScheme("light");
    expect(document.documentElement.getAttribute("data-slotted-scheme")).toBe(
      "light",
    );
  });

  it("paints the browser's bar in the scheme's surface", () => {
    stubMatchMedia(false);
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#000000";
    document.head.append(meta);
    document.documentElement.style.setProperty("--slotted-surface", "#fafafa");
    try {
      applyScheme("light");
      expect(meta.content).toBe("#fafafa");
    } finally {
      meta.remove();
      document.documentElement.style.removeProperty("--slotted-surface");
    }
  });
});
