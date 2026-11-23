import type {
  BorderEdge,
  StyleData,
} from "@/features/spreadsheets/files/snapshot";
import {
  borderStyles,
  builtinFormats,
  escapeXml,
  firstCustomFormat,
  toArgb,
} from "@/features/spreadsheets/files/xlsx-formats";

const formatNumbers = new Map(
  Object.entries(builtinFormats).map(([id, code]) => [code, Number(id)]),
);

// Collects the styles of the cells of a workbook and writes xl/styles.xml. A cell names its
// style by the position register returns; position 0 is the style of a cell without one.
export class StyleWriter {
  private readonly fonts = ['<font><sz val="11"/><name val="Arial"/></font>'];
  // An XLSX reader takes the first two fills as "none" and "gray125" whatever the file says.
  private readonly fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  private readonly borders = [
    "<border><left/><right/><top/><bottom/></border>",
  ];
  private readonly formats = new Map<string, number>();
  private readonly xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>',
  ];
  private readonly known = new Map<string, number>();

  register(style: StyleData | null | undefined): number {
    if (style === null || style === undefined) return 0;

    const key = JSON.stringify(style);
    const known = this.known.get(key);
    if (known !== undefined) return known;

    const font = indexOf(this.fonts, fontXml(style));
    const fill = indexOf(this.fills, fillXml(style));
    const border = indexOf(this.borders, borderXml(style));
    const format = this.formatNumber(style.n?.pattern);
    const alignment = alignmentXml(style);

    this.xfs.push(
      `<xf numFmtId="${String(format)}" fontId="${String(font)}" fillId="${String(fill)}" ` +
        `borderId="${String(border)}" applyNumberFormat="1" applyFont="1" applyFill="1" ` +
        `applyBorder="1"${alignment === "" ? "/>" : ` applyAlignment="1">${alignment}</xf>`}`,
    );
    this.known.set(key, this.xfs.length - 1);

    return this.xfs.length - 1;
  }

  xml(): string {
    const formats = [...this.formats]
      .map(
        ([code, id]) =>
          `<numFmt numFmtId="${String(id)}" formatCode="${escapeXml(code)}"/>`,
      )
      .join("");

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (formats === ""
        ? ""
        : `<numFmts count="${String(this.formats.size)}">${formats}</numFmts>`) +
      list("fonts", this.fonts) +
      list("fills", this.fills) +
      list("borders", this.borders) +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      list("cellXfs", this.xfs) +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }

  private formatNumber(pattern: string | undefined): number {
    if (pattern === undefined || pattern === "" || pattern === "General")
      return 0;

    const builtin = formatNumbers.get(pattern);
    if (builtin !== undefined) return builtin;

    const custom = this.formats.get(pattern);
    if (custom !== undefined) return custom;

    const id = firstCustomFormat + this.formats.size;
    this.formats.set(pattern, id);

    return id;
  }
}

function list(name: string, items: readonly string[]): string {
  return `<${name} count="${String(items.length)}">${items.join("")}</${name}>`;
}

// The position of xml in items, added at the end when new.
function indexOf(items: string[], xml: string): number {
  const at = items.indexOf(xml);
  if (at !== -1) return at;

  items.push(xml);

  return items.length - 1;
}

function fontXml(style: StyleData): string {
  const color = toArgb(style.cl?.rgb);

  return (
    "<font>" +
    (style.bl === 1 ? "<b/>" : "") +
    (style.it === 1 ? "<i/>" : "") +
    (style.st?.s === 1 ? "<strike/>" : "") +
    (style.ul?.s === 1 ? "<u/>" : "") +
    `<sz val="${String(style.fs ?? 11)}"/>` +
    (color === undefined ? "" : `<color rgb="${color}"/>`) +
    `<name val="${escapeXml(style.ff ?? "Arial")}"/>` +
    "</font>"
  );
}

function fillXml(style: StyleData): string {
  const color = toArgb(style.bg?.rgb);

  return color === undefined
    ? '<fill><patternFill patternType="none"/></fill>'
    : `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/></patternFill></fill>`;
}

function borderXml(style: StyleData): string {
  const edge = (name: string, data: BorderEdge | null | undefined) => {
    const line =
      data === null || data === undefined ? undefined : borderStyles[data.s];
    if (line === undefined) return `<${name}/>`;

    const color = toArgb(data?.cl?.rgb) ?? "FF000000";

    return `<${name} style="${line}"><color rgb="${color}"/></${name}>`;
  };

  return (
    "<border>" +
    edge("left", style.bd?.l) +
    edge("right", style.bd?.r) +
    edge("top", style.bd?.t) +
    edge("bottom", style.bd?.b) +
    "</border>"
  );
}

const horizontal: Readonly<Record<number, string>> = {
  1: "left",
  2: "center",
  3: "right",
};
const vertical: Readonly<Record<number, string>> = {
  1: "top",
  2: "center",
  3: "bottom",
};

function alignmentXml(style: StyleData): string {
  const attributes = [
    horizontal[style.ht ?? 0] === undefined
      ? ""
      : ` horizontal="${horizontal[style.ht ?? 0] ?? ""}"`,
    vertical[style.vt ?? 0] === undefined
      ? ""
      : ` vertical="${vertical[style.vt ?? 0] ?? ""}"`,
    style.tb === 3 ? ' wrapText="1"' : "",
  ].join("");

  return attributes === "" ? "" : `<alignment${attributes}/>`;
}
