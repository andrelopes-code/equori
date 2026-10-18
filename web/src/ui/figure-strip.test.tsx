import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FigureStrip } from "@/ui/figure-strip";
import { FigureStripItem } from "@/ui/figure-strip-item";

// Ledger sheet decision L12.
describe("FigureStrip", () => {
  it("pairs each label with its figure and caption under one named list", () => {
    render(
      <FigureStrip label="Balances">
        <FigureStripItem label="Available" caption="2 accounts">
          10
        </FigureStripItem>
        <FigureStripItem label="Cards">20</FigureStripItem>
        <FigureStripItem label="Loans">30</FigureStripItem>
      </FigureStrip>,
    );
    const list = screen.getByLabelText("Balances");
    expect(list.tagName).toBe("DL");
    expect(
      within(list)
        .getAllByRole("term")
        .map((node) => node.textContent),
    ).toEqual(["Available", "Cards", "Loans"]);
    expect(
      within(list)
        .getAllByRole("definition")
        .map((node) => node.textContent),
    ).toEqual(["10", "2 accounts", "20", "30"]);
  });
});
