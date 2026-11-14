import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { emptyCustody } from "@/features/transactions/custody-entry/custody-draft";
import { custodyProblems } from "@/features/transactions/custody-entry/custody-problems";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

const t: TFunction = (key) => catalogEn[key];
const account = { id: "a" } as Account;

describe("custodyProblems", () => {
  it("names every missing field of an empty transfer", () => {
    expect(
      custodyProblems(
        emptyCustody("2026-11-10"),
        { brokerage: undefined, holding: undefined },
        t,
      ),
    ).toEqual({
      brokerage_id: catalogEn["entry.required.account"],
      instrument: catalogEn["trade.required.securityAccount"],
      to: catalogEn["custody.required.to"],
      quantity: catalogEn["custody.required.quantity"],
    });
  });

  it("refuses nothing in a complete transfer", () => {
    const draft = { ...emptyCustody("2026-11-10"), toId: "b", quantity: 40 };

    expect(
      custodyProblems(draft, { brokerage: account, holding: account }, t),
    ).toEqual({});
  });
});
