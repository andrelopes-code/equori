import { describe, expect, it } from "vitest";

import {
  contentFromFile,
  csvWorkbook,
  UnsupportedFileError,
} from "@/features/spreadsheets/files/content-from-file";
import type { WorkbookData } from "@/features/spreadsheets/files/snapshot";
import { writeXlsx } from "@/features/spreadsheets/files/xlsx-write";

describe("csvWorkbook", () => {
  it("writes numbers as numbers, skips empty fields and leaves room after the rows", () => {
    const workbook = csvWorkbook(
      "Data;Valor\n23/11/2026;1.234,56\n;-2\n",
      "Página1",
    );
    const sheet = workbook.sheets?.["sheet-1"];

    expect(workbook.sheetOrder).toEqual(["sheet-1"]);
    expect(sheet?.name).toBe("Página1");
    expect(sheet?.cellData).toEqual({
      0: { 0: { v: "Data", t: 1 }, 1: { v: "Valor", t: 1 } },
      1: { 0: { v: "23/11/2026", t: 1 }, 1: { v: 1234.56, t: 2 } },
      2: { 1: { v: -2, t: 2 } },
    });
    expect(sheet?.rowCount).toBe(1000);
    expect(sheet?.columnCount).toBe(26);
  });
});

describe("contentFromFile", () => {
  it("reads a CSV file into one sheet named by the caller", async () => {
    const file = new File(["a,b\n1,2\n"], "Extrato 2026.CSV", {
      type: "text/csv",
    });

    const imported = await contentFromFile(file, "Sheet1");
    const content = imported.content as WorkbookData;

    expect(imported.name).toBe("Extrato 2026");
    expect(content.sheets?.["sheet-1"]?.name).toBe("Sheet1");
    expect(content.sheets?.["sheet-1"]?.cellData?.[1]?.[1]).toEqual({
      v: 2,
      t: 2,
    });
  });

  it("reads the sheets of an XLSX file with their names", async () => {
    const bytes = writeXlsx({
      sheetOrder: ["a"],
      sheets: {
        a: { id: "a", name: "Plan", cellData: { 0: { 0: { v: 7 } } } },
      },
    });
    const file = new File([bytes], "plan.xlsx");

    const imported = await contentFromFile(file, "Sheet1");
    const content = imported.content as WorkbookData;

    expect(imported.name).toBe("plan");
    expect(Object.values(content.sheets ?? {}).map((s) => s.name)).toEqual([
      "Plan",
    ]);
  });

  it("refuses a file of another kind", async () => {
    await expect(
      contentFromFile(new File(["%PDF"], "statement.pdf"), "Sheet1"),
    ).rejects.toBeInstanceOf(UnsupportedFileError);
  });
});
