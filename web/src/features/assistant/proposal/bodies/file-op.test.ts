import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  fileOp,
  filePeriod,
} from "@/features/assistant/proposal/bodies/file-op";

type Preview = components["schemas"]["AssistantPreview"];

function preview(
  action: string,
  changes: [string, { text?: string; date?: string }][],
): Preview {
  return {
    action,
    changes: changes.map(([field, after]) => ({ field, after })),
  };
}

describe("fileOp", () => {
  it("reads a statement import: account, lines and period", () => {
    const op = fileOp(
      preview("import_statement_file", [
        ["source", { text: "extrato.ofx" }],
        ["account", { text: "Nubank conta" }],
        ["count", { text: "48" }],
        ["from", { date: "2026-10-01" }],
        ["until", { date: "2026-10-31" }],
      ]),
    );

    expect(op).toEqual({
      name: "extrato.ofx",
      target: "Nubank conta",
      day: undefined,
      lines: { key: "assistant.body.lines.other", count: 48 },
      from: "2026-10-01",
      until: "2026-10-31",
    });
  });

  it("reads a price import: instruments, prices and period", () => {
    const op = fileOp(
      preview("import_price_file", [
        ["source", { text: "precos.csv" }],
        ["count", { text: "120" }],
        ["instruments", { text: "3" }],
        ["from", { date: "2025-01-02" }],
        ["until", { date: "2025-06-30" }],
      ]),
    );

    expect(op.target).toEqual({
      key: "assistant.body.instruments.other",
      count: 3,
    });
    expect(op.lines).toEqual({
      key: "assistant.body.prices.other",
      count: 120,
    });
    expect(op.from).toBe("2025-01-02");
  });

  it("reads an attachment: the day and the transaction, no lines", () => {
    const op = fileOp(
      preview("attach_file", [
        ["source", { text: "recibo.jpg" }],
        ["date", { date: "2026-11-18" }],
        ["transaction", { text: "Mercado" }],
      ]),
    );

    expect(op).toEqual({
      name: "recibo.jpg",
      target: "Mercado",
      day: "2026-11-18",
      lines: undefined,
      from: undefined,
      until: undefined,
    });
  });

  it("writes the period with one year when both ends share it", () => {
    const base = fileOp(preview("import_price_file", []));

    expect(
      filePeriod({ ...base, from: "2026-10-01", until: "2026-10-31" }, "pt-BR"),
    ).toEqual({
      from: "01/10",
      until: "31/10/2026",
    });
    expect(
      filePeriod({ ...base, from: "2025-12-29", until: "2026-01-05" }, "pt-BR"),
    ).toEqual({
      from: "29/12/2025",
      until: "05/01/2026",
    });
    expect(filePeriod({ ...base, from: "2026-10-01" }, "pt-BR")).toBeNull();
  });
});
