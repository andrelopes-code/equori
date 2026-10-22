import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RefreshButton } from "@/ui/refresh-button";
import { useRefresh } from "@/ui/use-refresh";

function Probe({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const { refreshing, refresh } = useRefresh(onRefresh);
  return (
    <RefreshButton
      label="Refresh"
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RefreshButton", () => {
  it("shows its wait at once, holds it at least 400 ms and refuses a second press", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const refresh = () => {
      calls += 1;
      return Promise.resolve();
    };
    render(<Probe onRefresh={refresh} />);
    const button = screen.getByRole("button", { name: "Refresh" });

    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    button.click();
    expect(calls).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
