import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  cashEffect,
  estimatedResult,
  grossOf,
  lotsCost,
  saleCost,
  soldCost,
} from "@/features/transactions/entry-model/trade-math";

interface FifoCase {
  name: string;
  lots: { quantity: number; cost: number }[];
  quantity: number;
  cost: number;
}

// The Go test TestFIFOCostFixture reads the same file.
const fifoCases = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../internal/ledger/domain/testdata/fifo-cost.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as FifoCase[];

describe("trade math", () => {
  // S21: buy 150 MXRF11 at 10.05 and sell 50 at 10.80.
  it("computes the gross of a purchase and of a sale", () => {
    expect(grossOf(150, 0, "10.05", 2)).toBe(150750);
    expect(grossOf(50, 0, "10.80", 2)).toBe(54000);
  });

  it("rounds the gross half to even once", () => {
    expect(grossOf(1, 0, "0.125", 2)).toBe(12);
    expect(grossOf(1, 0, "0.135", 2)).toBe(14);
    expect(grossOf(15, 1, "0.1", 2)).toBe(15);
  });

  it("keeps every decimal of the price", () => {
    expect(grossOf(3, 0, "0.333333333333", 2)).toBe(100);
    expect(grossOf(1, 0, "123456789012.123456789012", 2)).toBe(12345678901212);
  });

  it("sets the cash effect of a purchase and of a sale", () => {
    expect(cashEffect("buy", 150750, 490, 0)).toBe(-151240);
    expect(cashEffect("sell", 54000, 210, 0)).toBe(53790);
    expect(cashEffect("sell", 54000, 210, 100)).toBe(53690);
  });

  it("removes the cost of a sale at average cost, half to even", () => {
    expect(saleCost(151240, 50, 150)).toBe(50413);
    expect(saleCost(151240, 150, 150)).toBe(151240);
    expect(saleCost(5, 1, 2)).toBe(2);
    expect(saleCost(7, 1, 2)).toBe(4);
  });

  it.each(fifoCases)("removes the cost by lot: $name", (c) => {
    expect(lotsCost(c.lots, c.quantity)).toBe(c.cost);
  });

  it("takes the cost by method", () => {
    const lots = [
      { quantity: { amount: 10 }, cost: { amount: 100000 } },
      { quantity: { amount: 10 }, cost: { amount: 120000 } },
    ];
    expect(soldCost({ method: "fifo", lots }, 220000, 5, 20)).toBe(50000);
    expect(soldCost({ method: "average", lots: [] }, 220000, 5, 20)).toBe(
      55000,
    );
  });

  it("estimates the result against the cost", () => {
    expect(estimatedResult(54000, 210, 50413)).toBe(3377);
  });
});
