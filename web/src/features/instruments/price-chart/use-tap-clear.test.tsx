import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTapClear } from "@/features/instruments/price-chart/use-tap-clear";

describe("useTapClear", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears the period after a tap", () => {
    expect(changes("touch", 104)).toEqual([[null]]);
  });

  it("keeps the period after a drag by touch", () => {
    expect(changes("touch", 140)).toEqual([]);
  });

  it("leaves the mouse to the chart", () => {
    expect(changes("mouse", 100)).toEqual([]);
  });
});

function changes(pointerType: string, releasedAt: number): unknown[][] {
  const onChange = vi.fn();

  render(<Plot onChange={onChange} />);
  fireEvent.pointerDown(screen.getByRole("img"), {
    pointerType,
    clientX: 100,
    clientY: 50,
  });
  fireEvent.pointerUp(window, { clientX: releasedAt, clientY: 50 });
  vi.advanceTimersByTime(400);

  return onChange.mock.calls;
}

function Plot({ onChange }: { onChange: (period: null) => void }) {
  const handlePointerDown = useTapClear(() => {
    onChange(null);
  });

  return <div role="img" onPointerDown={handlePointerDown} />;
}
