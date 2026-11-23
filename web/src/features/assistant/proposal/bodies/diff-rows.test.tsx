import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiffRows } from "@/features/assistant/proposal/bodies/diff-rows";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("DiffRows", () => {
  it("writes the rows of a new category in the reader's language", () => {
    const { container } = renderWithProviders(
      <DiffRows
        changes={[
          { field: "name", after: { text: "Pets" } },
          { field: "category_class", after: { text: "expense" } },
          { field: "parent", after: { text: "Leisure" } },
          { field: "icon", after: { text: "utensils" } },
        ]}
      />,
      { fetch: fakeApi({}) },
    );

    expect(
      screen.getByText(catalogEn["assistant.field.category_class"]),
    ).toBeVisible();
    expect(
      screen.getByText(catalogEn["assistant.value.class.expense"]),
    ).toBeVisible();
    expect(screen.queryByText("expense")).toBeNull();
    expect(screen.getByText("Under")).toBeVisible();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("keeps an icon the app does not draw as written", () => {
    const { container } = renderWithProviders(
      <DiffRows changes={[{ field: "icon", after: { text: "unknown" } }]} />,
      { fetch: fakeApi({}) },
    );

    expect(screen.getByText("unknown")).toBeVisible();
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });
});
