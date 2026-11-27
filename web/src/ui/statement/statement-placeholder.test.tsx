import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { StatementPlaceholder } from "@/ui/statement/statement-placeholder";

describe("StatementPlaceholder", () => {
  // List item lays out its start, body and end only inside its content part: outside it the
  // placeholder rows lose their padding and gap.
  it("draws each part of a row inside the row's content", () => {
    renderWithProviders(<StatementPlaceholder label="Statement" />, {
      fetch: fakeApi({}),
    });

    const items = Array.from(
      screen
        .getByRole("list", { name: "Statement" })
        .querySelectorAll('[data-ui="list-item"]'),
    );
    const parts = items.map((item) =>
      Array.from(item.children, (child) => child.getAttribute("data-part")),
    );

    expect(items).toHaveLength(8);
    expect(parts).toEqual(Array.from({ length: 8 }, () => ["content"]));
  });

  // A placeholder that covers a word takes the word's whole line box: a one-word bar, and the
  // title and the subtitle touch. A bare text placeholder is one cap tall inside its line.
  it("draws each line as a bar of a stated length, under a square mark", () => {
    renderWithProviders(<StatementPlaceholder label="Statement" />, {
      fetch: fakeApi({}),
    });

    const item = screen
      .getByRole("list", { name: "Statement" })
      .querySelector('[data-ui="list-item"]');
    const lines = Array.from(
      item?.querySelectorAll(
        '[data-part="label"] [data-ui="skeleton"], [data-part="description"] [data-ui="skeleton"], [data-part="end"] [data-ui="skeleton"]',
      ) ?? [],
    );
    const mark = item?.querySelector(
      '[data-part="start"] [data-ui="skeleton"]',
    );

    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.textContent)).toEqual(["", "", ""]);
    expect(
      lines.every((line) =>
        line.getAttribute("style")?.includes("inline-size"),
      ),
    ).toBe(true);
    expect(mark?.getAttribute("data-shape")).toBe("square");
  });
});
