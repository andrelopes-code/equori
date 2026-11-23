import type {
  BorderEdge,
  StyleData,
} from "@/features/spreadsheets/files/snapshot";
import {
  borderStyles,
  builtinFormats,
  fromArgb,
} from "@/features/spreadsheets/files/xlsx-formats";

const borderNumbers = new Map(
  Object.entries(borderStyles).map(([id, name]) => [name, Number(id)]),
);
const horizontal: Readonly<Record<string, number>> = {
  left: 1,
  center: 2,
  right: 3,
};
const vertical: Readonly<Record<string, number>> = {
  top: 1,
  center: 2,
  bottom: 3,
};

// The fonts every desktop system draws. A cell in another font of the file takes the font of
// the editor: a browser without that font would draw a fallback of another shape.
const commonFonts = new Set([
  "Arial",
  "Courier New",
  "Georgia",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
]);

function children(parent: Element | undefined, name: string): Element[] {
  return parent === undefined
    ? []
    : [...parent.children].filter((child) => child.localName === name);
}

function child(parent: Element | undefined, name: string): Element | undefined {
  return children(parent, name)[0];
}

// The style of each entry of cellXfs in xl/styles.xml, by its position: the number a cell
// names in its attribute s. A colour of the theme of the file is left to the default.
export function readStyles(document: Document): StyleData[] {
  const root = document.documentElement;
  const formats = new Map<number, string>(
    Object.entries(builtinFormats).map(([id, code]) => [Number(id), code]),
  );

  for (const format of children(child(root, "numFmts"), "numFmt"))
    formats.set(
      Number(format.getAttribute("numFmtId")),
      format.getAttribute("formatCode") ?? "",
    );

  const fonts = children(child(root, "fonts"), "font").map(readFont);
  const fills = children(child(root, "fills"), "fill").map(readFill);
  const borders = children(child(root, "borders"), "border").map(readBorder);

  return children(child(root, "cellXfs"), "xf").map((xf) => {
    const pattern = formats.get(Number(xf.getAttribute("numFmtId") ?? 0));
    const alignment = child(xf, "alignment");
    const style: StyleData = {
      ...fonts[Number(xf.getAttribute("fontId") ?? 0)],
      ...fills[Number(xf.getAttribute("fillId") ?? 0)],
      ...borders[Number(xf.getAttribute("borderId") ?? 0)],
    };

    if (pattern !== undefined && pattern !== "") style.n = { pattern };

    const ht = horizontal[alignment?.getAttribute("horizontal") ?? ""];
    const vt = vertical[alignment?.getAttribute("vertical") ?? ""];
    if (ht !== undefined) style.ht = ht;
    if (vt !== undefined) style.vt = vt;
    if (alignment?.getAttribute("wrapText") === "1") style.tb = 3;

    return style;
  });
}

function flag(font: Element, name: string): boolean {
  const element = child(font, name);

  return element !== undefined && element.getAttribute("val") !== "0";
}

function readFont(font: Element): StyleData {
  const style: StyleData = {};
  const size = Number(child(font, "sz")?.getAttribute("val"));
  const name = child(font, "name")?.getAttribute("val");
  const color = fromArgb(child(font, "color")?.getAttribute("rgb") ?? null);

  if (flag(font, "b")) style.bl = 1;
  if (flag(font, "i")) style.it = 1;
  if (flag(font, "strike")) style.st = { s: 1 };
  if (flag(font, "u")) style.ul = { s: 1 };
  if (Number.isFinite(size) && size > 0) style.fs = size;
  if (name !== null && name !== undefined && commonFonts.has(name))
    style.ff = name;
  if (color !== undefined) style.cl = { rgb: color };

  return style;
}

function readFill(fill: Element): StyleData {
  const pattern = child(fill, "patternFill");
  if (pattern?.getAttribute("patternType") !== "solid") return {};

  const color = fromArgb(
    child(pattern, "fgColor")?.getAttribute("rgb") ?? null,
  );

  return color === undefined ? {} : { bg: { rgb: color } };
}

function readBorder(border: Element): StyleData {
  const edges: Partial<Record<"t" | "r" | "b" | "l", BorderEdge>> = {};

  for (const [key, name] of [
    ["l", "left"],
    ["r", "right"],
    ["t", "top"],
    ["b", "bottom"],
  ] as const) {
    const edge = child(border, name);
    const line = borderNumbers.get(edge?.getAttribute("style") ?? "");
    if (line === undefined) continue;

    edges[key] = {
      s: line,
      cl: {
        rgb:
          fromArgb(child(edge, "color")?.getAttribute("rgb") ?? null) ??
          "#000000",
      },
    };
  }

  return Object.keys(edges).length === 0 ? {} : { bd: edges };
}
