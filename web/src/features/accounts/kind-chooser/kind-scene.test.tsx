import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KindPlate } from "@/features/accounts/kind-chooser/kind-plate";
import { KindScene } from "@/features/accounts/kind-chooser/kind-scene";

describe("KindScene", () => {
  it("draws a hidden 352 by 140 stage with four rings", () => {
    const { container } = render(<KindScene kind="checking" />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 352 140");
    expect(svg?.querySelectorAll("[data-ring]")).toHaveLength(4);
  });

  it("sizes the rings of a square kind as rounded squares", () => {
    const { container } = render(<KindScene kind="checking" />);
    const rings = [...container.querySelectorAll("rect[data-ring]")];

    expect(rings.map((ring) => ring.getAttribute("width"))).toEqual([
      "400",
      "300",
      "210",
      "116",
    ]);
    expect(rings.map((ring) => ring.getAttribute("rx"))).toEqual([
      "108",
      "81",
      "56.7",
      "31.32",
    ]);
    expect(rings[0]?.getAttribute("x")).toBe("-24");
    expect(rings[0]?.getAttribute("y")).toBe("-130");
  });

  it("sizes the rings of a circular kind as circles centred at 176, 70", () => {
    const { container } = render(<KindScene kind="savings" />);
    const rings = [...container.querySelectorAll("circle[data-ring]")];

    expect(rings.map((ring) => ring.getAttribute("r"))).toEqual([
      "200",
      "150",
      "105",
      "58",
    ]);
    expect(rings[0]?.getAttribute("cx")).toBe("176");
    expect(rings[0]?.getAttribute("cy")).toBe("70");
  });

  it("places the panel drawing at translate(130.4 24.4) scale(1.9)", () => {
    const { container } = render(<KindScene kind="checking" />);
    const place = container.querySelector("g[transform]");

    expect(place?.getAttribute("transform")).toBe(
      "translate(130.4 24.4) scale(1.9)",
    );
    expect(place?.children).toHaveLength(1);
    expect(place?.firstElementChild?.children).toHaveLength(7);
  });

  // A CSS transform on the element that holds the transform attribute replaces it: the hover lift
  // moves an inner group, never the placed one.
  it("lifts a group inside the placed one", () => {
    const { container } = render(<KindScene kind="checking" />);
    const groups = container.querySelectorAll("g[transform]");

    expect(groups).toHaveLength(1);
    expect(groups[0]?.firstElementChild?.tagName).toBe("g");
    expect(groups[0]?.firstElementChild?.getAttribute("transform")).toBeNull();
  });

  it.each([
    ["checking", {}, "asset"],
    ["credit_card", {}, "liability"],
    ["checking", { tone: "neutral" }, "neutral"],
    ["loan", { tone: "neutral" }, "neutral"],
  ] as const)("%s with props %j carries data-tone %s", (kind, props, want) => {
    const { container } = render(<KindScene kind={kind} {...props} />);

    expect(container.querySelector("svg")?.getAttribute("data-tone")).toBe(
      want,
    );
  });
});

describe("KindPlate", () => {
  it("draws a hidden 48 by 48 plate of a rounded square then the plate drawing", () => {
    const { container } = render(<KindPlate kind="checking" />);
    const svg = container.querySelector("svg");
    const plate = svg?.firstElementChild;

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 48 48");
    expect(plate?.tagName).toBe("rect");
    expect(plate?.getAttribute("rx")).toBe("13");
    expect(svg?.children).toHaveLength(7);
  });

  it("draws the plate of a circular kind as a circle of radius 24", () => {
    const { container } = render(<KindPlate kind="reserve" />);
    const plate = container.querySelector("svg")?.firstElementChild;

    expect(plate?.tagName).toBe("circle");
    expect(plate?.getAttribute("r")).toBe("24");
  });

  it("takes the neutral tone", () => {
    const { container } = render(<KindPlate kind="loan" tone="neutral" />);

    expect(container.querySelector("svg")?.getAttribute("data-tone")).toBe(
      "neutral",
    );
  });
});
