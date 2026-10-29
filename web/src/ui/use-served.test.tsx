import { screen } from "@testing-library/react";
import type { NavigateOptions } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";
import { useServed } from "@/ui/use-served";

const id = "11111111-1111-4111-8111-111111111111";

const cases: [string, NavigateOptions, boolean, boolean][] = [
  ["a phone route", { to: "/transactions" }, true, true],
  ["a desktop-only route", { to: "/planning" }, false, true],
  ["a desktop-only child", { to: "/accounts/new" }, false, true],
  [
    "a phone tab",
    {
      to: "/cards/$accountId",
      params: { accountId: id },
      search: { tab: "plans" },
    },
    true,
    true,
  ],
  [
    "a desktop-only tab",
    { to: "/accounts/$id", params: { id }, search: { tab: "reconciliation" } },
    false,
    true,
  ],
  [
    "a record without a tab",
    { to: "/accounts/$id", params: { id } },
    true,
    true,
  ],
];

describe("useServed (ADR 027, S2 and S5)", () => {
  it.each(cases)("answers for %s", (_, options, phone, desk) => {
    setViewport(390);
    const atPhone = render(options);
    setViewport(1280);
    const atDesk = render(options);

    expect([atPhone, atDesk]).toEqual([phone, desk]);
  });
});

function render(options: NavigateOptions): boolean {
  const result = renderWithRouter(<Probe options={options} />, {
    path: "/",
    fetch: fakeApi({}),
  });
  const served = screen.getByTestId("served").textContent === "yes";
  result.unmount();
  return served;
}

interface ProbeProps {
  options: NavigateOptions;
}

function Probe({ options }: ProbeProps) {
  const served = useServed();

  return <output data-testid="served">{served(options) ? "yes" : "no"}</output>;
}
