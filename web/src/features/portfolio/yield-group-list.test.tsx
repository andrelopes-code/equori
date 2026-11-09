import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { YieldGroupList } from "@/features/portfolio/yield-group-list";
import type { YieldGroup } from "@/features/portfolio/yield-figures";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

function group(negative: boolean): YieldGroup {
  return {
    key: "g",
    title: "Group",
    period: "90 days",
    rows: [
      { key: "r", term: "Term", value: "FIGURE", negative, emphasis: false },
    ],
  };
}

function figureTone(): string {
  return screen.getByText("FIGURE").getAttribute("data-tone") ?? "inherit";
}

describe("YieldGroupList", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["a positive figure", false, "success"],
    ["a negative figure", true, "danger"],
  ] as const)("reads %s", (_name, negative, tone) => {
    renderWithProviders(<YieldGroupList group={group(negative)} />, {
      fetch: fakeApi({}),
    });

    expect(figureTone()).toBe(tone);
  });

  it("keeps the text's own tone when the amounts are hidden", () => {
    hideAmounts();
    renderWithProviders(<YieldGroupList group={group(false)} />, {
      fetch: fakeApi({}),
    });

    expect(figureTone()).toBe("inherit");
  });
});
