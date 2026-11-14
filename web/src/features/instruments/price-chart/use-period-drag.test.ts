import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePeriodDrag } from "@/features/instruments/price-chart/use-period-drag";

const press = (stop = vi.fn(), clientX = 100) => ({
  button: 0,
  clientX,
  stopPropagation: stop,
});

const release = (clientX: number) =>
  window.dispatchEvent(new MouseEvent("pointerup", { clientX }));

describe("usePeriodDrag", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the period between the press and the date under the pointer", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => usePeriodDrag(onChange));

    act(() => {
      result.current.handleActiveDate("2026-10-01");
      result.current.handlePointerDown(press());
      result.current.handleActiveDate("2026-10-11");
    });

    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-10-01",
      to: "2026-10-11",
    });
  });

  it("stops the press, so the chart does not pan", () => {
    const stop = vi.fn();
    const { result } = renderHook(() => usePeriodDrag(vi.fn()));

    act(() => {
      result.current.handleActiveDate("2026-10-01");
      result.current.handlePointerDown(press(stop));
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("clears the period when the pointer is released within 4 px of the press", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => usePeriodDrag(onChange));

    act(() => {
      result.current.handleActiveDate("2026-10-01");
      result.current.handlePointerDown(press());
      result.current.handleActiveDate("2026-10-02");
      release(103);
    });

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("keeps the period when the pointer is released 4 px or more from the press", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => usePeriodDrag(onChange));

    act(() => {
      result.current.handleActiveDate("2026-10-01");
      result.current.handlePointerDown(press());
      result.current.handleActiveDate("2026-10-11");
      release(104);
    });

    expect(onChange).not.toHaveBeenCalledWith(null);
  });

  it("ignores a press of another button and a press outside the plot", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => usePeriodDrag(onChange));

    act(() => {
      result.current.handlePointerDown(press());
      result.current.handleActiveDate("2026-10-01");
      result.current.handlePointerDown({
        ...press(),
        button: 2,
      });
      result.current.handleActiveDate("2026-10-11");
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the period on Escape", () => {
    const onChange = vi.fn();
    renderHook(() => usePeriodDrag(onChange));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
