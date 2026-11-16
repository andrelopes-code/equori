import { describe, expect, it } from "vitest";

import {
  applicationBody,
  contractSummary,
  emptyFixedIncomeDraft,
} from "@/features/transactions/fixed-income-entry/fixed-income-draft";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key, vars) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    String(vars?.[name] ?? whole),
  );

const fmt = {
  locale: "en-US",
  money: () => "R$10,000.00",
};

const APPLICATION = "0192f3a4-5b6c-7d8e-9f00-112233445566";
const BROKERAGE = "0192f3a4-0000-7d8e-9f00-112233445566";

function draft(patch = {}) {
  return {
    ...emptyFixedIncomeDraft(APPLICATION, BROKERAGE, "2026-03-02"),
    subtype: "cdb",
    issuer: "Banco X",
    amount: 1000000,
    currency: "BRL",
    returnKind: "rate" as const,
    indexId: "cdi",
    percent: "110",
    maturesOn: "2028-03-02",
    ...patch,
  };
}

describe("applicationBody", () => {
  it("builds the body of S479", () => {
    expect(applicationBody(draft(), t)).toEqual({
      body: {
        application_id: APPLICATION,
        brokerage_id: BROKERAGE,
        applied_on: "2026-03-02",
        amount: { amount: 1000000, currency: "BRL" },
        contract: {
          subtype: "cdb",
          issuer: "Banco X",
          matures_on: "2028-03-02",
          index_id: "cdi",
          percent_of_index_bp: 11000,
          daily_liquidity: false,
        },
      },
    });
  });

  it("sends a fixed rate as the spread with no index", () => {
    const result = applicationBody(
      draft({ returnKind: "fixed", percent: "12" }),
      t,
    );

    expect(result).toMatchObject({
      body: { contract: { spread_bp: 1200 } },
    });
    expect(JSON.stringify(result)).not.toContain("index_id");
  });

  it("sends inflation with an index and a spread", () => {
    const result = applicationBody(
      draft({ returnKind: "inflation", indexId: "ipca", percent: "6.5" }),
      t,
    );

    expect(result).toMatchObject({
      body: { contract: { index_id: "ipca", spread_bp: 650 } },
    });
  });

  it("refuses an empty issuer", () => {
    expect(applicationBody(draft({ issuer: "" }), t)).toEqual({
      errors: { "contract.issuer": "Enter the issuer." },
    });
  });

  it("refuses an amount of zero", () => {
    expect(applicationBody(draft({ amount: 0 }), t)).toEqual({
      errors: { amount: "Enter an amount." },
    });
  });
});

describe("contractSummary", () => {
  it("writes the contract in one line", () => {
    expect(contractSummary(draft(), t, fmt)).toBe(
      "CDB Banco X · 110% of CDI · matures 03/02/2028 · R$10,000.00",
    );
  });
});
