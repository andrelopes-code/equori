import { screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { NameCell } from "@/features/portfolio/contribution-plan/ideal/name-cell";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

// CN20: the tag shows the goal alone, so it fits the name column; the sentence stays for a reader.
it("tags a reserved member with the goal and says what the tag means", () => {
  const { container } = renderWithProviders(
    <NameCell name="TSLA34" position={0} reserved="Emergency fund" />,
    { fetch: fakeApi({}) },
  );

  const tag = container.querySelector('[data-ui="tag"]');

  expect(tag?.textContent).toBe("reserved for Emergency fund");
  expect(tag?.getAttribute("title")).toBe("reserved for Emergency fund");
  expect(screen.getByText("Emergency fund")).toBeVisible();
  expect(screen.getByText("reserved for")).toHaveAttribute(
    "data-ui",
    "visually-hidden",
  );
});
