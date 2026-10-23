// Rules as data, rendered to the text the theme compiler takes. A rule reaches the library only
// through `data-ui`, `data-part` and the attributes a family sets (the compiler refuses the rest),
// so selectors are built by the helpers here and not written by hand.

export type Declarations = Readonly<Record<string, string>>;

export interface Rule {
  readonly selectors: readonly string[];
  readonly declarations: Declarations;
}

// Rules under a condition: `@media`, `@container` or `@supports`.
export interface Conditional {
  readonly prelude: string;
  readonly rules: readonly Rule[];
}

export type Block = Rule | Conditional;

export const rule = (
  selectors: string | readonly string[],
  declarations: Declarations,
): Rule => ({
  selectors: typeof selectors === "string" ? [selectors] : selectors,
  declarations,
});

export const media = (query: string, rules: readonly Rule[]): Conditional => ({
  prelude: `@media ${query}`,
  rules,
});

export const container = (
  query: string,
  rules: readonly Rule[],
): Conditional => ({ prelude: `@container ${query}`, rules });

export const supports = (
  query: string,
  rules: readonly Rule[],
): Conditional => ({ prelude: `@supports ${query}`, rules });

export const family = (name: string) => `[data-ui="${name}"]`;

export const part = (name: string, partName: string) =>
  `${family(name)}[data-part="${partName}"]`;

export const child = (name: string, partName: string) =>
  `${family(name)} > [data-part="${partName}"]`;

export const mix = (
  color: string,
  percent: string | number,
  base = "transparent",
) =>
  `color-mix(in oklab, ${color} ${typeof percent === "number" ? `${String(percent)}%` : percent}, ${base})`;

export const blur = (radius: string, saturate: string): Declarations => {
  const filter = `blur(${radius}) saturate(${saturate})`;
  return { "-webkit-backdrop-filter": filter, "backdrop-filter": filter };
};

export const noBlur: Declarations = {
  "-webkit-backdrop-filter": "none",
  "backdrop-filter": "none",
};

const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => (line === "" ? line : `  ${line}`))
    .join("\n");

function renderRule(
  { selectors, declarations }: Rule,
  within: (selector: string) => string,
): string {
  const body = Object.entries(declarations)
    .map(([property, value]) => `  ${property}: ${value};`)
    .join("\n");
  return `${selectors.map(within).join(",\n")} {\n${body}\n}`;
}

// `within` scopes every selector, so the glass is written once and held to one scheme in one place.
export function render(
  blocks: readonly Block[],
  within: (selector: string) => string,
): string[] {
  return blocks.map((block) =>
    "prelude" in block
      ? `${block.prelude} {\n${indent(
          block.rules.map((r) => renderRule(r, within)).join("\n\n"),
        )}\n}`
      : renderRule(block, within),
  );
}
