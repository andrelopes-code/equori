import { describe, expect, it } from "vitest";

import {
  editPriceText,
  formatPriceText,
  parsePriceText,
} from "@/ui/money/price-text";

describe("formatPriceText", () => {
  it.each([
    ["1234.5", "pt-BR", "1.234,5"],
    ["1234.5", "en", "1,234.5"],
    ["300.266666666667", "pt-BR", "300,266666666667"],
    ["9.50", "en", "9.50"],
    ["1234567", "pt-BR", "1.234.567"],
    ["0.05", "pt-BR", "0,05"],
    ["", "pt-BR", ""],
    ["10,05", "pt-BR", "10,05"],
  ])("writes %s in %s as %s", (value, locale, expected) => {
    expect(formatPriceText(value, locale)).toBe(expected);
  });
});

describe("editPriceText", () => {
  it.each([
    ["1234.5", "pt-BR", "1234,5"],
    ["1234.5", "en", "1234.5"],
    ["", "en", ""],
  ])("writes %s in %s as %s", (value, locale, expected) => {
    expect(editPriceText(value, locale)).toBe(expected);
  });
});

describe("parsePriceText", () => {
  it.each([
    ["1.234,56", "pt-BR", "1234.56"],
    ["1,234.56", "en", "1234.56"],
    ["300,27", "pt-BR", "300.27"],
    ["300.27", "pt-BR", "300.27"],
    ["300,27", "en", "300.27"],
    ["10", "en", "10"],
    [" 5,5 ", "pt-BR", "5.5"],
    [",5", "pt-BR", "0.5"],
    ["1.234.5", "pt-BR", null],
    ["", "pt-BR", null],
    ["0", "en", null],
    ["0,00", "pt-BR", null],
    ["1.1234567890123", "en", null],
    ["abc", "en", null],
    ["300,", "pt-BR", null],
  ])("reads %j in %s as %j", (text, locale, expected) => {
    expect(parsePriceText(text, locale)).toBe(expected);
  });
});
