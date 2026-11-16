import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RegionFlag } from "@/ui/region/region-flag";

const flagOf = (region: string) =>
  render(<RegionFlag region={region} />).container.firstElementChild;

describe("RegionFlag", () => {
  it.each(["BR", "US", "EU"])("draws the artwork of %s", (region) => {
    const flag = flagOf(region);

    expect(flag?.querySelector("svg")).not.toBeNull();
    expect(flag).toHaveAttribute("data-art", region);
  });

  it("draws a globe for the global region", () => {
    expect(flagOf("global")).toHaveAttribute("data-art", "global");
  });

  it("draws a plate with the code of a region without artwork", () => {
    const flag = flagOf("DE");

    expect(flag).toHaveAttribute("data-art", "plate");
    expect(flag).toHaveTextContent("DE");
  });

  it("is decorative", () => {
    expect(flagOf("BR")).toHaveAttribute("aria-hidden", "true");
  });

  it("states its size", () => {
    const { container } = render(<RegionFlag region="BR" size="lg" />);

    expect(container.firstElementChild).toHaveAttribute("data-size", "lg");
  });
});
