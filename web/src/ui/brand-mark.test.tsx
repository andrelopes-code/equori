import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "@/ui/brand-mark";

const sources = import.meta.glob<string>("/public/icon.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});
const icon = sources["/public/icon.svg"] ?? "";

const pathsOf = (svg: string) =>
  [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);

describe("BrandMark", () => {
  it("draws the paths of public/icon.svg, unchanged", () => {
    const { container } = render(<BrandMark size={22} />);
    const drawn = [...container.querySelectorAll("path")].map((p) =>
      p.getAttribute("d"),
    );
    expect(drawn).toEqual(pathsOf(icon));
  });

  it("keeps the viewBox of public/icon.svg", () => {
    const { container } = render(<BrandMark size={22} />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      /viewBox="([^"]+)"/.exec(icon)?.[1],
    );
  });
});
