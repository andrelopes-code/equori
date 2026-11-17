import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { PageStack } from "@/ui/page-layout/page-stack";

it("draws its blocks in one element and keeps the caller's attributes and class", () => {
  render(
    <PageStack aria-busy="true" className="own" data-testid="stack">
      <p>first</p>
      <p>second</p>
    </PageStack>,
  );

  const stack = screen.getByTestId("stack");

  expect(stack.children).toHaveLength(2);
  expect(stack).toHaveAttribute("aria-busy", "true");
  expect(stack.className.split(" ")).toHaveLength(2);
  expect(stack).toHaveClass("own");
});
