import { describe, expect, it } from "vitest";

import {
  formOf,
  incomeErrors,
  incomeOf,
} from "@/features/portfolio/projection/incomes-block/income-form";

const form = { name: " Rent ", amount: 100, startAge: "60", endAge: "70" };

describe("incomeErrors", () => {
  it.each([
    { name: "a valid income", patch: {}, errors: {} },
    { name: "no end age", patch: { endAge: " " }, errors: {} },
    { name: "start 18", patch: { startAge: "18" }, errors: {} },
    { name: "end 120", patch: { endAge: "120" }, errors: {} },
    { name: "no name", patch: { name: " " }, errors: { name: true } },
    { name: "amount 0", patch: { amount: 0 }, errors: { amount: true } },
    {
      name: "start 17",
      patch: { startAge: "17" },
      errors: { startAge: [18, 120] },
    },
    {
      name: "start 121 and no end",
      patch: { startAge: "121", endAge: "" },
      errors: { startAge: [18, 120] },
    },
    {
      name: "start empty",
      patch: { startAge: "" },
      errors: { startAge: [18, 120] },
    },
    {
      name: "end equal to start",
      patch: { endAge: "60" },
      errors: { endAge: [61, 120] },
    },
    {
      name: "end 121",
      patch: { endAge: "121" },
      errors: { endAge: [61, 120] },
    },
    {
      name: "end after a start at 120",
      patch: { startAge: "120", endAge: "120" },
      errors: { endAge: [120, 120] },
    },
    {
      name: "end not a number",
      patch: { endAge: "7o" },
      errors: { endAge: [61, 120] },
    },
  ])("PJ8: $name", ({ patch, errors }) => {
    expect(incomeErrors({ ...form, ...patch })).toEqual(errors);
  });
});

describe("incomeOf", () => {
  it("trims the name and leaves an empty end age out", () => {
    expect(incomeOf(form)).toEqual({
      name: "Rent",
      amount: 100,
      start_age: 60,
      end_age: 70,
    });
    expect(incomeOf({ ...form, endAge: "" })).not.toHaveProperty("end_age");
  });

  it("writes back the form it came from", () => {
    expect(formOf(incomeOf(form))).toEqual({ ...form, name: "Rent" });
    expect(formOf(null)).toEqual({
      name: "",
      amount: 0,
      startAge: "",
      endAge: "",
    });
  });
});
