import { beforeEach, describe, expect, it } from "vitest";

import { applyCorners, readCorners } from "@/theme/corners";

const axis = () =>
  document.documentElement.getAttribute("data-slotted-corners");

describe("corners", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-slotted-corners");
  });

  it("defaults to the theme's own corners when storage is empty", () => {
    expect(readCorners()).toBe("standard");
  });

  it("returns the stored corners", () => {
    localStorage.setItem("equori.corners", "round");
    expect(readCorners()).toBe("round");
  });

  it("ignores a stored value that is not a corner style", () => {
    localStorage.setItem("equori.corners", "blobby");
    expect(readCorners()).toBe("standard");
  });

  it.each(["square", "soft", "standard", "round"] as const)(
    "stores %s and sets the corner axis on the document",
    (corners) => {
      applyCorners(corners);
      expect(localStorage.getItem("equori.corners")).toBe(corners);
      expect(axis()).toBe(corners);
    },
  );
});
