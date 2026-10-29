import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";
import { AppLink } from "@/ui/app-link";

describe("AppLink (ADR 027, S6)", () => {
  it("draws a desktop-only destination as text on a phone", () => {
    setViewport(390);

    renderWithRouter(<AppLink to={{ to: "/planning" }}>Planning</AppLink>, {
      path: "/",
      fetch: fakeApi({}),
    });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Planning")).toBeInTheDocument();
  });

  it("links a phone destination on a phone", () => {
    setViewport(390);

    renderWithRouter(
      <AppLink to={{ to: "/transactions" }}>Transactions</AppLink>,
      { path: "/", fetch: fakeApi({}) },
    );

    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });
});
