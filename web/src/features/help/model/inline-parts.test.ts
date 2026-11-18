import { describe, expect, it } from "vitest";

import { inlineParts } from "@/features/help/model/inline-parts";

describe("inlineParts", () => {
  it("splits a line into text, strong words and links", () => {
    expect(
      inlineParts("Open **Pay** in [Cards](/cards), then `wait`."),
    ).toEqual([
      { type: "text", text: "Open " },
      { type: "strong", text: "Pay" },
      { type: "text", text: " in " },
      { type: "link", text: "Cards", href: "/cards" },
      { type: "text", text: ", then wait." },
    ]);
  });

  it("joins the lines of a step", () => {
    expect(inlineParts("One\ntwo")).toEqual([
      { type: "text", text: "One two" },
    ]);
  });
});
