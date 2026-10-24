import { describe, expect, it } from "vitest";

import {
  cashEffect,
  estimatedResult,
  grossOf,
  saleCost,
} from "@/features/transactions/trade-math";

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

  it("estimates the result against the cost", () => {
    expect(estimatedResult(54000, 210, 50413)).toBe(3377);
  });
});
