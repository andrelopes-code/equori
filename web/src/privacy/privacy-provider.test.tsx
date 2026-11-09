import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  IDLE_MS,
  PrivacyProvider,
  usePrivacy,
} from "@/privacy/privacy-provider";

function Probe() {
  const { hidden, toggle } = usePrivacy();
  return (
    <button type="button" onClick={toggle}>
      {hidden ? "hidden" : "visible"}
    </button>
  );
}

function renderProbe() {
  return render(
    <PrivacyProvider>
      <Probe />
    </PrivacyProvider>,
  );
}

describe("PrivacyProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts visible when nothing is stored", () => {
    renderProbe();
    expect(screen.getByRole("button")).toHaveTextContent("visible");
  });

  it("is hidden on the first render when hidden is stored", () => {
    localStorage.setItem("equori.privacy", "hidden");
    renderProbe();
    expect(screen.getByRole("button")).toHaveTextContent("hidden");
  });

  it("writes the preference on toggle and removes it on the second toggle", () => {
    renderProbe();
    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("equori.privacy")).toBe("hidden");
    expect(screen.getByRole("button")).toHaveTextContent("hidden");
    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("equori.privacy")).toBeNull();
    expect(screen.getByRole("button")).toHaveTextContent("visible");
  });

  it("follows a change made in another tab", () => {
    renderProbe();
    act(() => {
      localStorage.setItem("equori.privacy", "hidden");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "equori.privacy",
          newValue: "hidden",
        }),
      );
    });
    expect(screen.getByRole("button")).toHaveTextContent("hidden");
  });

  it("stays usable, and visible by default, when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderProbe();
    expect(screen.getByRole("button")).toHaveTextContent("visible");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("hidden");
  });

  it("is hidden for a consumer outside the provider", () => {
    render(<Probe />);
    expect(screen.getByRole("button")).toHaveTextContent("hidden");
  });
});

describe("PrivacyProvider automatic hiding", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function leaveTab() {
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  function wait(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  const rows: [string | null, "leave" | "idle", boolean][] = [
    ["never", "leave", false],
    ["never", "idle", false],
    ["leave", "leave", true],
    ["leave", "idle", false],
    ["idle", "idle", true],
    [null, "idle", false],
  ];

  it.each(rows)("auto %s, event %s, hidden %s", (auto, event, expected) => {
    if (auto !== null) localStorage.setItem("equori.privacyAuto", auto);
    renderProbe();
    if (event === "leave") leaveTab();
    else wait(IDLE_MS);
    expect(screen.getByRole("button")).toHaveTextContent(
      expected ? "hidden" : "visible",
    );
    expect(localStorage.getItem("equori.privacy")).toBe(
      expected ? "hidden" : null,
    );
  });

  it("stays visible one millisecond before the idle limit", () => {
    localStorage.setItem("equori.privacyAuto", "idle");
    renderProbe();
    wait(IDLE_MS - 1);
    expect(screen.getByRole("button")).toHaveTextContent("visible");
  });

  it("restarts the idle timer on activity", () => {
    localStorage.setItem("equori.privacyAuto", "idle");
    renderProbe();
    wait(200_000);
    act(() => {
      window.dispatchEvent(new Event("keydown"));
    });
    wait(IDLE_MS - 1);
    expect(screen.getByRole("button")).toHaveTextContent("visible");
  });
});
