import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { goalAccounts, withoutNesting } from "@/features/goals/goal-accounts";
import {
  accountFixtures,
  brokerageID,
  checkingID,
  stockID,
} from "@/testing/account-api";

type Account = components["schemas"]["Account"];
const fixtures = accountFixtures as Account[];
const names = (accounts: { name: string }[]) => accounts.map((a) => a.name);

describe("goal accounts", () => {
  it("offers open asset accounts and leaves out liabilities, closed and system accounts", () => {
    const offered = names(goalAccounts(fixtures));
    expect(offered).toContain("Nubank");
    expect(offered).not.toContain("Itaú Visa");
    expect(offered).not.toContain("Financiamento");
    expect(offered).not.toContain("Conta antiga");
    expect(offered).not.toContain("Opening balances");
  });

  it("offers a brokerage as a whole and each of its securities", () => {
    const offered = names(goalAccounts(fixtures));
    expect(offered).toContain("Corretora");
    expect(offered).toContain("PETR4");
  });

  it("hides the accounts above and below one already chosen", () => {
    const offered = (chosen: string[]) =>
      names(withoutNesting(goalAccounts(fixtures), fixtures, chosen));
    expect(offered([brokerageID])).not.toContain("PETR4");
    expect(offered([stockID])).not.toContain("Corretora");
    expect(offered([brokerageID])).toContain("Corretora");
    expect(offered([checkingID])).toContain("PETR4");
  });

  it("keeps a parent whose tree holds a single instrument", () => {
    expect(names(goalAccounts(fixtures))).toContain("Carteiras");
  });
});
