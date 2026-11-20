import { describe, expect, it } from "vitest";

import { windowText } from "@/features/assistant/view/window-text";

describe("windowText", () => {
  it("names a whole month", () => {
    expect(windowText({ from: "2026-10-01", to: "2026-10-31" }, "pt-BR")).toBe(
      "outubro 2026",
    );
  });

  it("joins two months of one year", () => {
    // Intl separates the range with thin spaces.
    const text = windowText({ from: "2026-09-01", to: "2026-10-31" }, "pt-BR");

    expect(text.replace(/\s/gu, " ")).toBe("set. – out. de 2026");
  });

  it("writes a range of days of one year without the year", () => {
    expect(windowText({ from: "2026-11-20", to: "2026-12-19" }, "pt-BR")).toBe(
      "20/11 – 19/12",
    );
  });

  it("writes a range of days across years with the years", () => {
    expect(windowText({ from: "2026-12-20", to: "2027-01-19" }, "pt-BR")).toBe(
      "20/12/2026 – 19/01/2027",
    );
  });

  it("writes one day", () => {
    expect(windowText({ at: "2026-11-19" }, "pt-BR")).toBe("19/11/2026");
  });

  it("is empty without dates", () => {
    expect(windowText({}, "pt-BR")).toBe("");
  });
});
