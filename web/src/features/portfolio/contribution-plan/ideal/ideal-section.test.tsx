import { expect, it } from "vitest";

import { IdealSection } from "@/features/portfolio/contribution-plan/ideal/ideal-section";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

// A group row is a name and a bar of its own length: equal blocks stacked 4 px apart are not it.
it("reserves the group rows as lines of different lengths", () => {
  const { container } = renderWithProviders(
    <IdealSection view={undefined} pending memberName={() => ""} />,
    { fetch: fakeApi({}) },
  );

  const lines = [...container.querySelectorAll('[data-ui="skeleton"]')];
  const sizes = new Set(lines.map((line) => line.getAttribute("style")));

  expect(lines).toHaveLength(5);
  expect(sizes.size).toBeGreaterThan(1);
});
