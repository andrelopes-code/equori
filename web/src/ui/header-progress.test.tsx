import { act, render, screen } from "@testing-library/react";
import { PageHeader } from "@slotted/react/page-header";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeaderProgress } from "@/ui/header-progress";

afterEach(() => {
  vi.useRealTimers();
});

function host(loading: boolean) {
  return (
    <PageHeader>
      <HeaderProgress loading={loading} delay={0} />
    </PageHeader>
  );
}

describe("HeaderProgress", () => {
  it("draws a new bar each time it returns after leaving, so its sweep starts at the edge", async () => {
    vi.useFakeTimers();
    const { rerender } = render(host(true));
    const first = screen.getByRole("progressbar");

    rerender(host(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    rerender(host(true));
    expect(screen.getByRole("progressbar")).not.toBe(first);
  });

  it("keeps the same bar while it is held on screen", async () => {
    vi.useFakeTimers();
    const { rerender } = render(host(true));
    const first = screen.getByRole("progressbar");

    rerender(host(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    rerender(host(true));
    expect(screen.getByRole("progressbar")).toBe(first);
  });
});
