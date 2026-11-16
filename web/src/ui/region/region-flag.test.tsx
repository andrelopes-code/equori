import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RegionFlag } from "@/ui/region/region-flag";

const flagOf = (region: string) =>
  render(<RegionFlag region={region} />).container.firstElementChild;

describe("RegionFlag", () => {
  it.each(["BR", "US", "EU", "DE"])(
    "draws the flag file of %s",
    async (region) => {
      const flag = flagOf(region);

      await waitFor(() => {
        expect(flag).toHaveAttribute("data-art", region);
      });
      expect(flag?.querySelector("img")?.getAttribute("src")).toBeTruthy();
    },
  );

  it("draws a plate with the code while the file loads", () => {
    const flag = flagOf("FR");

    expect(flag).toHaveAttribute("data-art", "plate");
    expect(flag).toHaveTextContent("FR");
  });

  it("draws a plate for a region without a file", async () => {
    const flag = flagOf("ZZ");

    await Promise.resolve();

    expect(flag).toHaveAttribute("data-art", "plate");
    expect(flag).toHaveTextContent("ZZ");
  });

  it("falls back to the plate when the file fails to load", async () => {
    const flag = flagOf("JP");
    await waitFor(() => {
      expect(flag).toHaveAttribute("data-art", "JP");
    });

    fireEvent.error(flag?.querySelector("img") as Element);

    await waitFor(() => {
      expect(flag).toHaveAttribute("data-art", "plate");
    });
    expect(flag).toHaveTextContent("JP");
  });

  it("draws a globe for the global region", () => {
    const flag = flagOf("global");

    expect(flag).toHaveAttribute("data-art", "global");
    expect(flag?.querySelector("svg")).not.toBeNull();
  });

  it("is decorative", () => {
    expect(flagOf("BR")).toHaveAttribute("aria-hidden", "true");
  });

  it("states its size", () => {
    const { container } = render(<RegionFlag region="BR" size="lg" />);

    expect(container.firstElementChild).toHaveAttribute("data-size", "lg");
  });
});
