import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setViewport } from "@/testing/viewport";
import { PageBack } from "@/ui/page-back";

describe("PageBack", () => {
  it("leaves the way back to the top app bar below 1024 px", () => {
    setViewport(1023);
    render(<PageBack href="/cards">Cards</PageBack>);
    expect(screen.queryByRole("link", { name: "Cards" })).toBeNull();
  });

  it("draws the way back from 1024 px", () => {
    setViewport(1024);
    render(<PageBack href="/cards">Cards</PageBack>);
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute(
      "href",
      "/cards",
    );
  });
});
