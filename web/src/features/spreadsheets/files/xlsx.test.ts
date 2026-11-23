import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { WorkbookData } from "@/features/spreadsheets/files/snapshot";
import {
  NotXlsxError,
  readXlsx,
} from "@/features/spreadsheets/files/xlsx-read";
import { writeXlsx } from "@/features/spreadsheets/files/xlsx-write";

const header = {
  bl: 1,
  fs: 12,
  ff: "Arial",
  cl: { rgb: "#FFFFFF" },
  bg: { rgb: "#1B1C1F" },
  ht: 2,
  vt: 2,
  tb: 3,
  bd: { b: { s: 8, cl: { rgb: "#FF0000" } } },
};

const workbook: WorkbookData = {
  sheetOrder: ["b", "a"],
  styles: { head: header, money: { n: { pattern: "#,##0.00" } } },
  sheets: {
    a: {
      id: "a",
      name: "Notes",
      hidden: 1,
      cellData: { 0: { 0: { v: "x" } } },
    },
    b: {
      id: "b",
      name: "Budget: 2027/1",
      freeze: { xSplit: 1, ySplit: 1, startRow: 1, startColumn: 1 },
      mergeData: [{ startRow: 4, endRow: 4, startColumn: 0, endColumn: 2 }],
      columnData: { 0: { w: 140 }, 3: { hd: 1 } },
      rowData: { 0: { h: 40 }, 6: { hd: 1 } },
      cellData: {
        0: {
          0: { v: 'Item <&> "quoted"', s: "head", t: 1 },
          1: { v: "Amount", s: header, t: 1 },
        },
        1: { 0: { v: "Rent", t: 1 }, 1: { v: 1500.5, s: "money", t: 2 } },
        2: {
          0: { v: true, t: 3 },
          1: { f: "=B2*2", si: "f1", v: 3001, t: 2 },
          2: { si: "f1" },
        },
        3: { 1: { f: '=IF(B2>0,"yes","no")', v: "yes", t: 1 } },
        4: { 0: { p: { body: { dataStream: "Rich text\r\n" } } } },
      },
    },
  },
};

describe("writeXlsx and readXlsx", () => {
  const read = readXlsx(writeXlsx(workbook));
  const [first = "", second = ""] = read.sheetOrder ?? [];
  const budget = read.sheets?.[first];
  const cells = budget?.cellData ?? {};
  const style = (row: number, column: number) => {
    const id = cells[row]?.[column]?.s;
    return typeof id === "string" ? read.styles?.[id] : undefined;
  };

  it("keeps the order, the names within the rules of XLSX and the hidden state", () => {
    expect(budget?.name).toBe("Budget  2027 1");
    expect(read.sheets?.[second]?.name).toBe("Notes");
    expect(read.sheets?.[second]?.hidden).toBe(1);
    expect(budget?.hidden).toBeUndefined();
  });

  it("keeps values by type", () => {
    expect(cells[0]?.[0]).toMatchObject({ v: 'Item <&> "quoted"', t: 1 });
    expect(cells[1]?.[1]).toMatchObject({ v: 1500.5, t: 2 });
    expect(cells[2]?.[0]).toMatchObject({ v: true, t: 3 });
    expect(cells[4]?.[0]).toMatchObject({ v: "Rich text", t: 1 });
  });

  it("keeps formulas and writes a shared formula at each of its cells", () => {
    expect(cells[2]?.[1]).toMatchObject({ f: "=B2*2", v: 3001 });
    expect(cells[2]?.[2]).toMatchObject({ f: "=C2*2" });
    expect(cells[3]?.[1]).toMatchObject({
      f: '=IF(B2>0,"yes","no")',
      v: "yes",
    });
  });

  it("keeps the style of a cell, named or written in the cell", () => {
    expect(style(0, 0)).toEqual(header);
    expect(style(0, 1)).toEqual(header);
    expect(style(1, 1)).toMatchObject({ n: { pattern: "#,##0.00" } });
    expect(cells[1]?.[0]?.s).toBeUndefined();
  });

  it("keeps merged cells, sizes, hidden rows and columns and frozen panes", () => {
    expect(budget?.mergeData).toEqual([
      { startRow: 4, endRow: 4, startColumn: 0, endColumn: 2 },
    ]);
    expect(budget?.columnData).toEqual({ 0: { w: 140 }, 3: { hd: 1 } });
    expect(budget?.rowData).toEqual({ 0: { h: 40 }, 6: { hd: 1 } });
    expect(budget?.freeze).toEqual({
      xSplit: 1,
      ySplit: 1,
      startRow: 1,
      startColumn: 1,
    });
    expect(budget?.rowCount).toBe(1000);
    expect(budget?.columnCount).toBe(26);
  });

  it("writes one sheet for a workbook without sheets", () => {
    const empty = readXlsx(writeXlsx({}));

    expect(empty.sheetOrder).toHaveLength(1);
  });

  it("writes parts that are well-formed XML", () => {
    for (const [path, bytes] of Object.entries(
      unzipSync(writeXlsx(workbook)),
    )) {
      const document = new DOMParser().parseFromString(
        new TextDecoder().decode(bytes),
        "application/xml",
      );

      expect(document.getElementsByTagName("parsererror"), path).toHaveLength(
        0,
      );
    }
  });
});

// A file as a desktop spreadsheet writes it: shared strings with runs, a shared formula, a
// built-in date format, one column entry for a range and a colour of the theme.
const main =
  'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const desktop = zipSync({
  "xl/workbook.xml": strToU8(
    `<workbook ${main} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Extrato" sheetId="1" r:id="rId3"/></sheets></workbook>`,
  ),
  "xl/_rels/workbook.xml.rels": strToU8(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Target="worksheets/sheet1.xml"/></Relationships>',
  ),
  "xl/sharedStrings.xml": strToU8(
    `<sst ${main}><si><t>Data</t></si><si><r><t>Val</t></r><r><rPr><b/></rPr><t>or</t></r><rPh><t>x</t></rPh></si></sst>`,
  ),
  "xl/styles.xml": strToU8(
    `<styleSheet ${main}><fonts><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font></fonts><fills><fill><patternFill patternType="none"/></fill></fills><borders><border/></borders><cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>`,
  ),
  "xl/worksheets/sheet1.xml": strToU8(
    `<worksheet ${main}><cols><col min="1" max="2" width="20" customWidth="1"/></cols><sheetData>` +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" s="1"><v>46349</v></c><c r="B2"><v>10</v></c><c r="C2"><f t="shared" ref="C2:C3" si="0">B2*$B$2</f><v>100</v></c></row>' +
      '<row r="3"><c r="B3"><v>-2.5</v></c><c r="C3"><f t="shared" si="0"/><v>-25</v></c><c r="D3" t="e"><v>#DIV/0!</v></c></row>' +
      "</sheetData></worksheet>",
  ),
});

describe("readXlsx on a file of a desktop spreadsheet", () => {
  const read = readXlsx(desktop);
  const sheet = Object.values(read.sheets ?? {})[0];
  const cells = sheet?.cellData ?? {};

  it("reads shared strings, numbers and an error text", () => {
    expect(sheet?.name).toBe("Extrato");
    expect(cells[0]?.[0]?.v).toBe("Data");
    expect(cells[0]?.[1]?.v).toBe("Valor");
    expect(cells[2]?.[1]).toMatchObject({ v: -2.5, t: 2 });
    expect(cells[2]?.[3]?.v).toBe("#DIV/0!");
  });

  it("reads a date as its serial number with the format of the file", () => {
    const id = cells[1]?.[0]?.s;

    expect(cells[1]?.[0]?.v).toBe(46349);
    expect(
      typeof id === "string" ? read.styles?.[id] : undefined,
    ).toMatchObject({
      n: { pattern: "m/d/yyyy" },
    });
  });

  it("moves a shared formula to each cell that names it", () => {
    expect(cells[1]?.[2]?.f).toBe("=B2*$B$2");
    expect(cells[2]?.[2]?.f).toBe("=B3*$B$2");
  });

  it("leaves a font this system may lack to the editor", () => {
    const styled = Object.values(read.styles ?? {});

    expect(styled.length).toBeGreaterThan(0);
    expect(styled.every((style) => style.ff === undefined)).toBe(true);
  });

  it("sizes each column of a range", () => {
    expect(sheet?.columnData).toEqual({ 0: { w: 140 }, 1: { w: 140 } });
  });
});

describe("readXlsx on another file", () => {
  it.each([
    ["bytes that are no ZIP", strToU8("a,b\n1,2\n")],
    ["a ZIP without a workbook", zipSync({ "a.txt": strToU8("x") })],
  ])("refuses %s", (_name, bytes) => {
    expect(() => readXlsx(bytes)).toThrow(NotXlsxError);
  });
});
