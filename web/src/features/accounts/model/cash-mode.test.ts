// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { defaultCashMode } from "@/features/accounts/model/cash-mode";

type Account = components["schemas"]["Account"];

const inter = "e0000000-0000-4000-8000-000000000010";
const other = "e0000000-0000-4000-8000-000000000011";
const broker = "e0000000-0000-4000-8000-000000000012";

function account(id: string, over: Partial<Account>): Account {
  return {
    id,
    name: id,
    class: "asset",
    kind: "checking",
    currency: "BRL",
    institution_id: inter,
    ...over,
  };
}

// BC16: the money stays in an account of the institution when one can pay from it.
describe("defaultCashMode", () => {
  const cases: {
    name: string;
    accounts: Account[];
    institution: string;
    want: "institution" | "own";
  }[] = [
    {
      name: "an open base-currency checking account of the institution",
      accounts: [account("a", {})],
      institution: inter,
      want: "institution",
    },
    {
      name: "an account of another institution only",
      accounts: [account("a", { institution_id: other })],
      institution: inter,
      want: "own",
    },
    {
      name: "a closed account",
      accounts: [account("a", { closed_on: "2026-01-01" })],
      institution: inter,
      want: "own",
    },
    {
      name: "an account in another currency",
      accounts: [account("a", { currency: "USD" })],
      institution: inter,
      want: "own",
    },
    {
      name: "a liability",
      accounts: [account("a", { class: "liability", kind: "credit_card" })],
      institution: inter,
      want: "own",
    },
    {
      name: "a brokerage",
      accounts: [account("a", { kind: "brokerage" })],
      institution: inter,
      want: "own",
    },
    {
      name: "the cash account of a brokerage",
      accounts: [
        account(broker, { kind: "brokerage" }),
        account("a", { kind: "brokerage", parent_id: broker }),
      ],
      institution: inter,
      want: "own",
    },
    {
      name: "a child of a brokerage that is not itself a brokerage",
      accounts: [
        account(broker, { kind: "brokerage" }),
        account("a", { parent_id: broker }),
      ],
      institution: inter,
      want: "own",
    },
  ];

  it.each(cases)("returns $want for $name", (c) => {
    expect(defaultCashMode(c.accounts, c.institution, "BRL")).toBe(c.want);
  });

  it("returns own when no institution is chosen", () => {
    expect(defaultCashMode([account("a", {})], null, "BRL")).toBe("own");
  });
});
