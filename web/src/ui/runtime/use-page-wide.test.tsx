import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { setViewport } from "@/testing/viewport";
import { PageRegionWide, usePageWide } from "@/ui/runtime/use-page-wide";

describe("usePageWide", () => {
  it.each(cases)(
    "is $expected at a $viewport px viewport with the region $region",
    ({ viewport, region, expected }) => {
      setViewport(viewport);

      const { result } = renderHook(() => usePageWide(), {
        wrapper: region === "unmeasured" ? undefined : wrappers[region],
      });

      expect(result.current).toBe(expected);
    },
  );
});

const cases = [
  { viewport: 1440, region: "unmeasured", expected: true },
  { viewport: 1440, region: "wide", expected: true },
  // The assistant pane beside the page leaves it a tablet's width on a desktop viewport.
  { viewport: 1440, region: "narrow", expected: false },
  { viewport: 800, region: "wide", expected: false },
] as const;

const wrappers = {
  wide: ({ children }: { children: ReactNode }) => (
    <PageRegionWide value={true}>{children}</PageRegionWide>
  ),
  narrow: ({ children }: { children: ReactNode }) => (
    <PageRegionWide value={false}>{children}</PageRegionWide>
  ),
};
