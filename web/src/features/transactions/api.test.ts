import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { accountKeys, balanceKeys } from "@/features/accounts";
import { setupKeys } from "@/features/setup";
import {
  transactionKeys,
  transactionMutated,
} from "@/features/transactions/api";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";

describe("transactionMutated", () => {
  it("invalidates lists, balances, every account cache and the currency lock check only", async () => {
    const client = new QueryClient();
    const touched = [
      transactionKeys.list({}),
      transactionKeys.detail("t-1"),
      balanceKeys.at("2026-10-17", "booked"),
      setupKeys.hasTransactions,
      accountKeys.list,
      ...[a, b, c].flatMap((id) => [
        accountKeys.detail(id),
        accountKeys.balance(id, "booked"),
        accountKeys.balance(id, "settled"),
        [...accountKeys.series(id), "2026-07-20", "2026-10-17"],
      ]),
    ];
    const untouched = [setupKeys.settings, setupKeys.payees];
    for (const key of [...touched, ...untouched]) {
      client.setQueryData(key, "cached");
    }

    await transactionMutated(client, [a, b]);

    for (const key of touched) {
      expect(
        client.getQueryState(key)?.isInvalidated,
        JSON.stringify(key),
      ).toBe(true);
    }
    for (const key of untouched) {
      expect(
        client.getQueryState(key)?.isInvalidated,
        JSON.stringify(key),
      ).toBe(false);
    }
  });
});
