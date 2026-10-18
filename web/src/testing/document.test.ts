import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// jsdom replaces the URL class, so readFileSync receives a path string instead of a URL object.
const read = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url).pathname, "utf8");

const html = read("../../index.html");
const manifest = JSON.parse(read("../../public/manifest.json")) as Record<
  string,
  unknown
>;

function metaContent(name: string): string | undefined {
  return new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`).exec(
    html,
  )?.[1];
}

describe("index.html", () => {
  it("sets the phone viewport with viewport-fit=cover", () => {
    expect(metaContent("viewport")).toBe(
      "width=device-width, initial-scale=1, viewport-fit=cover",
    );
  });

  it("links the web app manifest", () => {
    expect(html).toMatch(
      /<link\s+rel="manifest"\s+href="\/manifest\.json"\s*\/?>/,
    );
  });

  it("declares a theme-color", () => {
    expect(metaContent("theme-color")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("manifest.json", () => {
  it("describes a standalone app", () => {
    expect(manifest.name).toBe("equori");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
  });

  it("declares the SVG icon", () => {
    expect(manifest.icons).toEqual([
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ]);
  });

  it("uses the theme-color of index.html", () => {
    expect(manifest.theme_color).toBe(metaContent("theme-color"));
  });
});
