// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

// The loader of this file reads no alias.
// eslint-disable-next-line no-restricted-imports
import config from "../../vite.config.ts";

// Browser versions as lightningcss reads them: major << 16 | minor << 8.
type Targets = Partial<
  Record<"chrome" | "edge" | "firefox" | "safari" | "ios_saf", number>
>;

interface Lightningcss {
  transform(options: {
    filename: string;
    code: Buffer;
    minify: boolean;
    targets: Targets | undefined;
  }): { code: Buffer };
}

// The lightningcss that Vite minifies with: the build's CSS passes through it, the dev server's
// does not.
const lightningcss = createRequire(import.meta.resolve("vite"))(
  "lightningcss",
) as Lightningcss;

const stylesheets = [
  "node_modules/@slotted/react/dist/styles.css",
  "src/theme/equori.gen.css",
];

// A rule that starts with :is( at the root of the stylesheet or of a block.
const wrapped = /(^|[{}]):is\(/g;

describe("build.cssTarget", () => {
  // A target that lacks a selector of a list (:has before Firefox 121, :dir before Chrome 120)
  // makes the minifier wrap the list in :is(), which takes the specificity of its most specific
  // selector: a rule of the list then beats a rule it lost to in the development build.
  it.each(stylesheets)("keeps every selector list of %s as written", (file) => {
    const code = readFileSync(file);

    const minified = wrappedRules(code, undefined);
    const built = wrappedRules(code, targets(config.build?.cssTarget));

    expect(built).toBe(minified);
  });
});

function wrappedRules(code: Buffer, browsers: Targets | undefined): number {
  const { code: out } = lightningcss.transform({
    filename: "styles.css",
    code,
    minify: true,
    targets: browsers,
  });

  return out.toString().match(wrapped)?.length ?? 0;
}

// The esbuild form of the config ("safari16.4") in the form of lightningcss, as Vite converts it.
function targets(target: string | string[] | false | undefined): Targets {
  const names: Record<string, keyof Targets> = {
    chrome: "chrome",
    edge: "edge",
    firefox: "firefox",
    safari: "safari",
    ios: "ios_saf",
  };

  // Vite's default, baseline-widely-available, targets Firefox 114.
  if (target === undefined || target === false)
    throw new Error("build.cssTarget is unset");

  const list = typeof target === "string" ? [target] : target;
  const result: Targets = {};

  for (const entry of list) {
    const match = /^([a-z]+)(\d+)(?:\.(\d+))?$/.exec(entry);
    const name = match && names[match[1] ?? ""];

    if (!match || !name) throw new Error(`unknown cssTarget ${entry}`);

    result[name] = (Number(match[2]) << 16) | (Number(match[3] ?? 0) << 8);
  }

  return result;
}
