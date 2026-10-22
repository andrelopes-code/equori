import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import html from "@/../index.html?raw";
import script from "@/../public/boot.js?raw";

// Vitest turns a ?raw stylesheet into an empty string, so the file is read from disk, relative to web/ where the tests run.
const bootCSS = readFileSync("public/boot.css", "utf8");

function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: prefersDark && query === "(prefers-color-scheme: dark)",
    })),
  );
}

function boot() {
  // The script is page code held as text in public/boot.js; a <script> element runs it in a jsdom
  // realm that does not see the stubbed matchMedia.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
  new Function(script)();
  return {
    scheme: document.documentElement.getAttribute("data-slotted-scheme"),
    themeColor: document
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content"),
  };
}

describe("index.html boot script", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-slotted-scheme");
    document.head.innerHTML = '<meta name="theme-color" content="#0c0c0f">';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { stored: null, prefersDark: false, scheme: "dark", themeColor: "#0c0c0f" },
    {
      stored: "dark",
      prefersDark: false,
      scheme: "dark",
      themeColor: "#0c0c0f",
    },
    {
      stored: "light",
      prefersDark: true,
      scheme: "light",
      themeColor: "#f9fafe",
    },
    {
      stored: "system",
      prefersDark: true,
      scheme: "dark",
      themeColor: "#0c0c0f",
    },
    {
      stored: "system",
      prefersDark: false,
      scheme: "light",
      themeColor: "#f9fafe",
    },
    {
      stored: "sepia",
      prefersDark: false,
      scheme: "dark",
      themeColor: "#0c0c0f",
    },
  ])(
    "stored $stored with prefers-dark $prefersDark resolves to $scheme",
    ({ stored, prefersDark, scheme, themeColor }) => {
      if (stored !== null) localStorage.setItem("equori.scheme", stored);
      stubMatchMedia(prefersDark);
      expect(boot()).toEqual({ scheme, themeColor });
    },
  );

  it("resolves to dark when reading storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(boot()).toEqual({ scheme: "dark", themeColor: "#0c0c0f" });
  });

  it("paints the light surface for the light scheme before the application loads", () => {
    expect(bootCSS).toContain(
      'html[data-slotted-scheme="light"] {\n  background-color: #f9fafe;',
    );
  });

  it("takes the splash out of the flow and locks the document scroll while it shows", () => {
    expect(bootCSS).toMatch(
      /html:has\(\.boot-splash\)\s*\{[^}]*overflow:\s*hidden/,
    );
    expect(bootCSS).toMatch(
      /\.boot-splash\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0/,
    );
  });

  it("holds no inline script, inline style or style attribute, which the CSP of ADR 008 blocks", () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).not.toMatch(/\sstyle=/);
  });

  it("links the boot files and renders the brand mark inside #root", () => {
    expect(html).toContain('<script src="/boot.js"></script>');
    expect(html).toContain('<link rel="stylesheet" href="/boot.css" />');
    expect(html).toMatch(/<div id="root">[\s\S]*boot-logo[\s\S]*<\/div>/);
  });
});
