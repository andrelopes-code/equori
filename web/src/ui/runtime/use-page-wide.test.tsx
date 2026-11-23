import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setViewport } from "@/testing/viewport";
import { usePageWide } from "@/ui/runtime/use-page-wide";

describe("usePageWide", () => {
  it.each(cases)(
    "is $expected at a $viewport px viewport",
    ({ viewport, expected }) => {
      setViewport(viewport);

      const { result } = renderHook(() => usePageWide());

      expect(result.current).toBe(expected);
    },
  );
});

const cases = [
  { viewport: 1440, expected: true },
  { viewport: 800, expected: false },
] as const;
