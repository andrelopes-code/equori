import { describe, expect, it } from "vitest";

import { plotChart } from "@/features/assistant/view/plot/plot-chart";
import type { PlotSeries } from "@/features/assistant/view/plot/plot-records";
import type {
  ViewPlotSeries,
  ViewValue,
} from "@/features/assistant/view/view-types";

describe("plotChart", () => {
  it("reads a second unit on the end axis and stacks per axis", () => {
    const got = plotChart({
      series: [
        series(1, brl(1), { stack: true, tone: "success" }),
        series(2, brl(1), { stack: true }),
        series(3, { count: 1 }, { kind: "line", axis: "end", curve: "step" }),
      ],
      head: ["Mês", "Entradas", "Saídas", "Lançamentos"],
      marks: [],
      write,
      tick,
      average,
    });

    expect(
      got.series.map((s) => [s.field, s.kind, s.label, s.axis, s.stack]),
    ).toEqual([
      ["c1", "bar", "Entradas", "start", "start"],
      ["c2", "bar", "Saídas", "start", "start"],
      ["c3", "line", "Lançamentos", "end", undefined],
    ]);
    expect(got.series[0]?.tone).toBe("success");
    expect(got.series[2]?.curve).toBe("step");
    expect(Array.isArray(got.y)).toBe(true);
    expect(got.legend).toBe(true);
    expect(got.trigger).toBe("axis");
  });

  it("marks the average on its series' axis with its value written", () => {
    const got = plotChart({
      series: [series(1, brl(1), {})],
      head: ["Mês", "Entradas"],
      marks: [{ kind: "average", column: 1, value: brl(34183) }],
      write,
      tick,
      average,
    });

    expect(got.annotations).toEqual([
      { kind: "line", axis: "start", value: 34183, tone: "neutral" },
    ]);
    expect(got.averages).toEqual(["avg T34183"]);
    expect(Array.isArray(got.y)).toBe(false);
    expect(got.legend).toBe(false);
  });

  it("names two series in a legend", () => {
    const got = plotChart({
      series: [series(1, brl(1), {}), series(2, brl(1), { kind: "line" })],
      head: ["Mês", "Entradas", "Saídas"],
      marks: [],
      write,
      tick,
      average,
    });

    expect(got.legend).toBe(true);
  });

  it("draws a pie as a donut read by slice, with its legend", () => {
    const got = plotChart({
      series: [series(1, brl(1), { kind: "pie" })],
      head: ["Categoria", "Total"],
      marks: [],
      write,
      tick,
      average,
    });

    expect(got.series[0]?.kind).toBe("pie");
    expect(got.series[0]?.innerRadius).toBe(0.6);
    expect(got.trigger).toBe("item");
    expect(got.legend).toBe(true);
  });

  it("writes the axis ticks in whole units, the tooltip in full", () => {
    const got = plotChart({
      series: [series(1, brl(1), {})],
      head: ["Mês", "Entradas"],
      marks: [],
      write,
      tick,
      average,
    });

    const y = Array.isArray(got.y) ? got.y[0] : got.y;
    expect(typeof y.format === "function" && y.format(500, "pt-BR")).toBe(
      "T500",
    );
    const tooltip = got.series[0]?.format;
    expect(typeof tooltip === "function" && tooltip(500, "pt-BR")).toBe(
      "R$500",
    );
  });
});

function brl(amount: number): ViewValue {
  return { money: { amount, currency: "BRL" } };
}

function write(v: ViewValue): string {
  return v.money === undefined
    ? `n${String(v.count)}`
    : `R$${String(v.money.amount)}`;
}

function tick(v: ViewValue): string {
  return `T${String(v.money?.amount ?? v.count)}`;
}

function average(value: string): string {
  return `avg ${value}`;
}

function series(
  column: number,
  unit: ViewValue,
  drawn: Partial<ViewPlotSeries>,
): PlotSeries {
  return {
    field: `c${String(column)}`,
    column,
    unit,
    drawn: { column, kind: "bar", ...drawn },
  };
}
