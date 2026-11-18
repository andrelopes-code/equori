import { describe, expect, it } from "vitest";

import {
  choiceValue,
  indexChoices,
  resolveSecurity,
  type DraftSecurity,
} from "@/features/calculators/indexer-comparison/security-draft";

const cdi = { id: "cdi", period: "day" as const };
const ipca = { id: "ipca", period: "month" as const };
const row = (patch: Partial<DraftSecurity>): DraftSecurity => ({
  key: 1,
  choice: null,
  rate: "",
  taxed: true,
  ...patch,
});

describe("security draft", () => {
  it("resolves the default choice to the first index in its quoted form", () => {
    expect(resolveSecurity(row({ rate: "140" }), [cdi, ipca])).toEqual({
      form: "percent",
      index: "cdi",
      rate: 1.4,
      taxed: true,
    });
    expect(resolveSecurity(row({ rate: "6,5" }), [ipca]).form).toBe("spread");
  });

  it("resolves the default choice to a fixed rate while no index is offered", () => {
    expect(resolveSecurity(row({ rate: "8" }), [])).toEqual({
      form: "fixed",
      rate: 0.08,
      taxed: true,
    });
  });

  it("keeps an explicit choice and reads a rate that is not a number as null", () => {
    const got = resolveSecurity(row({ choice: "spread:cdi", rate: "x" }), [
      cdi,
    ]);

    expect(got).toEqual({
      form: "spread",
      index: "cdi",
      rate: null,
      taxed: true,
    });
  });

  it("offers a percent only over a daily index", () => {
    expect(indexChoices([cdi, ipca])).toEqual([
      { form: "percent", index: "cdi" },
      { form: "spread", index: "cdi" },
      { form: "spread", index: "ipca" },
    ]);
    expect(choiceValue({ form: "spread", index: "ipca" })).toBe("spread:ipca");
  });
});
