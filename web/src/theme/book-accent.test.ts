import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyAccent } from "@/theme/accent";
import { restoreAppearance } from "@/theme/appearance";
import {
  effectiveAccent,
  readActiveBooks,
  readBookAccents,
  suspendBookAccent,
  writeActiveBooks,
  writeBookAccents,
} from "@/theme/book-accent";

const seedProperty = "--slotted-seed-accent";

describe("effectiveAccent", () => {
  beforeEach(() => {
    localStorage.clear();
    suspendBookAccent(false);
  });

  afterEach(() => {
    suspendBookAccent(false);
  });

  it.each([
    ["indigo", '{"7":"emerald"}', "7", false, "emerald"],
    ["indigo", '{"7":"emerald"}', "8", false, "indigo"],
    ["indigo", '{"7":"#123456"}', "7", false, "#123456"],
    ["indigo", '{"7":"emerald"}', "7", true, "indigo"],
    ["indigo", "not json", "7", false, "indigo"],
    ["indigo", '{"7":"nope"}', "7", false, "indigo"],
    ["indigo", '{"7":"emerald"}', undefined, false, "indigo"],
  ])(
    "accent %s, map %s, active %s, suspended %s reads %s",
    (accent, map, active, suspended, expected) => {
      localStorage.setItem("equori.accent", accent);
      localStorage.setItem("equori.bookAccents", map);
      if (active !== undefined)
        localStorage.setItem("equori.activeBooks", active);
      suspendBookAccent(suspended);

      expect(effectiveAccent()).toBe(expected);
    },
  );
});

describe("book accent storage", () => {
  beforeEach(() => {
    localStorage.clear();
    suspendBookAccent(false);
  });

  it("drops the books outside the memberships when writing", () => {
    writeBookAccents({ "7": "emerald", "9": "pink" }, [7]);

    expect(localStorage.getItem("equori.bookAccents")).toBe('{"7":"emerald"}');
    expect(readBookAccents()).toEqual({ "7": "emerald" });
  });

  it("reads a malformed map as empty", () => {
    localStorage.setItem("equori.bookAccents", "not json");

    expect(readBookAccents()).toEqual({});
  });

  it("stores the active book and reads it back", () => {
    writeActiveBooks(9);

    expect(localStorage.getItem("equori.activeBooks")).toBe("9");
    expect(readActiveBooks()).toBe(9);
  });

  it("paints the accent of the book that becomes active", () => {
    writeBookAccents({ "7": "emerald" }, [7, 8]);

    writeActiveBooks(7);

    expect(document.documentElement.style.getPropertyValue(seedProperty)).toBe(
      "#10b981",
    );
  });

  it("paints the theme accent while suspended and the book accent after", () => {
    writeBookAccents({ "7": "emerald" }, [7]);
    writeActiveBooks(7);

    suspendBookAccent(true);

    expect(document.documentElement.style.getPropertyValue(seedProperty)).toBe(
      "",
    );

    suspendBookAccent(false);

    expect(document.documentElement.style.getPropertyValue(seedProperty)).toBe(
      "#10b981",
    );
  });

  it("repaints the book accent when the server restores the appearance", () => {
    localStorage.setItem("equori.activeBooks", "7");
    applyAccent("indigo");

    restoreAppearance({ bookAccents: '{"7":"pink"}' });

    expect(document.documentElement.style.getPropertyValue(seedProperty)).toBe(
      "#ec4899",
    );
  });
});
