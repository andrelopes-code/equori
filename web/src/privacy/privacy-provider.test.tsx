import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyProvider, usePrivacy } from "@/privacy/privacy-provider";

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
