import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDensity } from "@/theme/density";
import { useScheme } from "@/theme/scheme";

function SchemeProbe({ id }: { id: string }) {
  const [scheme, setScheme] = useScheme();
  return (
    <button
      type="button"
      data-testid={id}
      onClick={() => {
        setScheme("light");
      }}
    >
      {scheme}
    </button>
  );
}

function DensityProbe({ id }: { id: string }) {
  const [density, setDensity] = useDensity();
  return (
    <button
      type="button"
      data-testid={id}
      onClick={() => {
        setDensity("dense");
      }}
    >
      {density}
    </button>
  );
}

describe("theme preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps two readers of the scheme in step", () => {
    render(
      <>
        <SchemeProbe id="a" />
        <SchemeProbe id="b" />
      </>,
    );
    expect(screen.getByTestId("b")).toHaveTextContent("dark");
    act(() => {
      screen.getByTestId("a").click();
    });
    expect(screen.getByTestId("a")).toHaveTextContent("light");
    expect(screen.getByTestId("b")).toHaveTextContent("light");
  });

  it("keeps two readers of the density in step", () => {
    render(
      <>
        <DensityProbe id="a" />
        <DensityProbe id="b" />
      </>,
    );
    expect(screen.getByTestId("b")).toHaveTextContent("comfortable");
    act(() => {
      screen.getByTestId("a").click();
    });
    expect(screen.getByTestId("a")).toHaveTextContent("dense");
    expect(screen.getByTestId("b")).toHaveTextContent("dense");
  });

  it("keeps the choice for the page load when storage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    render(
      <>
        <SchemeProbe id="a" />
        <SchemeProbe id="b" />
      </>,
    );
    act(() => {
      screen.getByTestId("a").click();
    });
    expect(screen.getByTestId("b")).toHaveTextContent("light");
  });
});
