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
});
