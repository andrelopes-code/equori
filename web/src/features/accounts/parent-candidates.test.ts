import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { parentCandidates } from "@/features/accounts/parent-candidates";

type Account = components["schemas"]["Account"];

describe("parentCandidates", () => {
  it("keeps open accounts of the class, by name", () => {
    const accounts = [
      account("b", "Bravo", "asset"),
      account("a", "Alpha", "asset"),
      account("l", "Loan", "liability"),
      { ...account("c", "Closed", "asset"), closed_on: "2026-01-01" },
      { ...account("o", "Opening", "asset"), system_role: "opening_balances" },
    ] as Account[];

    const names = parentCandidates(accounts, "asset").map((a) => a.name);

    expect(names).toEqual(["Alpha", "Bravo"]);
  });

  it("leaves out the edited account and every account inside it", () => {
    const accounts = [
      account("root", "Root", "asset"),
      { ...account("child", "Child", "asset"), parent_id: "root" },
      { ...account("grand", "Grand", "asset"), parent_id: "child" },
      account("other", "Other", "asset"),
    ];

    const names = parentCandidates(accounts, "asset", "root").map(
      (a) => a.name,
    );

    expect(names).toEqual(["Other"]);
  });
});

function account(
  id: string,
  name: string,
  cls: "asset" | "liability",
): Account {
  return { id, name, class: cls } as Account;
}
