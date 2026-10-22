import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// jsdom replaces the URL class, so readFileSync receives a path string instead of a URL object.
const read = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url).pathname, "utf8");

const html = read("../../index.html");
const appCSS = read("../app/app.css");
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
  it("sets the phone viewport with viewport-fit=cover, resized by the keyboard", () => {
    expect(metaContent("viewport")).toBe(
      "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
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

  it("declares the PNG icons an installed app needs, a maskable one, and the SVG icon", () => {
    expect(manifest.icons).toEqual([
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ]);
  });

  it("uses the theme-color of index.html", () => {
    expect(manifest.theme_color).toBe(metaContent("theme-color"));
  });
});

// jsdom computes no layout, so the sizing chain that lets the app shell (block-size 100%, max 100dvh) fill the viewport is asserted on the stylesheet text.
describe("app.css document root sizing", () => {
  function rule(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(appCSS)?.[1] ?? "";
  }

  it("declares the sizing inside @layer app", () => {
    expect(appCSS).toMatch(/@layer app\s*\{/);
  });

  it("gives html and body the full block-size without a margin", () => {
    const declarations = rule("html,\n  body");
    expect(declarations).toMatch(/block-size:\s*100%/);
    expect(declarations).toMatch(/margin:\s*0/);
  });

  it("gives #root the dynamic viewport height", () => {
    expect(rule("#root")).toMatch(/block-size:\s*100dvh/);
  });
});

// Chromium on Android paints a translucent box over an element while it is pressed; no engine here renders it, so the declaration is asserted on the stylesheet text.
describe("app.css tap highlight", () => {
  it("clears the tap highlight on the document root inside @layer app, where every element inherits it", () => {
    const layerStart = appCSS.indexOf("@layer app {");
    const rule =
      /(^|\s)html\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent/.exec(
        appCSS,
      );
    expect(layerStart).toBeGreaterThan(-1);
    expect(rule?.index).toBeGreaterThan(layerStart);
  });
});

// A press or a long press on a control must not select its label; content stays selectable. No engine here renders a selection, so the declarations are asserted on the stylesheet text.
describe("app.css text selection", () => {
  function declarationsOf(selectorPart: string): string {
    const escaped = selectorPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`${escaped}[^{]*\\{([^}]*)\\}`).exec(appCSS)?.[1] ?? "";
  }

  it.each(["button", '[role="tab"]', '[role="menuitem"]', "a[href]"])(
    "disables selection and the touch callout on %s",
    (selector) => {
      const declarations = declarationsOf(selector);
      expect(declarations).toMatch(/(^|\s)user-select:\s*none/);
      expect(declarations).toMatch(/-webkit-touch-callout:\s*none/);
    },
  );

  it("leaves content and fields selectable", () => {
    expect(appCSS).not.toMatch(
      /(^|[\s,{])(html|body|input|textarea)\s*[,{][^}]*user-select:\s*none/,
    );
  });

  it("tints the selection with the theme's accent and keeps the text colour", () => {
    const declarations = declarationsOf("::selection");
    expect(declarations).toContain("var(--slotted-tone-accent-solid)");
    expect(declarations).not.toMatch(/(^|[;\s])color:/);
  });

  it("leaves the selection to the system under forced colours", () => {
    expect(appCSS).toMatch(
      /@media not \(forced-colors:\s*active\)\s*\{[^@]*::selection/,
    );
  });
});

// Scrollbars are drawn by the browser, so the declarations are asserted on the stylesheet text.
describe("app.css scrollbar", () => {
  const declarations =
    /(^|\s)html\s*\{([^}]*-webkit-tap-highlight-color[^}]*)\}/.exec(
      appCSS,
    )?.[2] ?? "";

  it("draws a thin scrollbar on the document", () => {
    expect(declarations).toMatch(/scrollbar-width:\s*thin/);
  });

  it("colours the thumb from the theme's strong border over a transparent track, as the library's own scroll regions do", () => {
    expect(declarations).toMatch(
      /scrollbar-color:\s*var\(--slotted-border-strong\)\s+transparent/,
    );
  });
});

describe("app.css scrollbar on touch", () => {
  const touch =
    /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?\})\s*\}/.exec(
      appCSS,
    )?.[1] ?? "";

  it("hides every scrollbar where the primary input is a finger", () => {
    expect(touch).toMatch(/html,\s*\*\s*\{[^}]*scrollbar-width:\s*none/);
  });
});
