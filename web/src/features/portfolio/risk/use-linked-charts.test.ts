import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLinkedCharts } from "@/features/portfolio/risk/use-linked-charts";

describe("useLinkedCharts", () => {
  it("RK7, RK8: shares the window and the month read, on the series each chart names", () => {
    const { result } = renderHook(() => useLinkedCharts());
    const stock = () => "stock";
    const none = () => undefined;

    expect(result.current.zoom).toEqual({ start: 0, end: 1 });
    expect(result.current.pointOf(stock)).toBeNull();

    act(() => {
      result.current.setZoom({ start: 0.5, end: 0.75 });
      result.current.setActive({ series: "portfolio", key: "mar-2024" });
    });

    expect(result.current.zoom).toEqual({ start: 0.5, end: 0.75 });
    expect(result.current.pointOf(stock)).toEqual({
      series: "stock",
      key: "mar-2024",
    });
    expect(result.current.pointOf(none)).toBeNull();

    act(() => {
      result.current.setActive(null);
    });

    expect(result.current.pointOf(stock)).toBeNull();
  });
});
