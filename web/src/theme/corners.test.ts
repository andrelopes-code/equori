import { beforeEach, describe, expect, it } from "vitest";

import { applyCorners, readCorners } from "@/theme/corners";

const radius = (step: string) =>
  document.documentElement.style.getPropertyValue(`--slotted-radius-${step}`);

describe("corners", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
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

  it.each([
    { corners: "square", xs: "0px", sm: "0px", md: "0px", lg: "0px" },
    { corners: "soft", xs: "1px", sm: "2px", md: "3px", lg: "4px" },
    { corners: "round", xs: "4px", sm: "8px", md: "12px", lg: "16px" },
  ] as const)(
    "stores $corners and writes its radius scale on the document",
    ({ corners, xs, sm, md, lg }) => {
      applyCorners(corners);
      expect(localStorage.getItem("equori.corners")).toBe(corners);
      expect([radius("xs"), radius("sm"), radius("md"), radius("lg")]).toEqual([
        xs,
        sm,
        md,
        lg,
      ]);
    },
  );

  it("leaves the theme's radius scale in force for the standard corners", () => {
    applyCorners("round");
    applyCorners("standard");
    expect([radius("xs"), radius("sm"), radius("md"), radius("lg")]).toEqual([
      "",
      "",
      "",
      "",
    ]);
  });
});
