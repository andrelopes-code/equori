import { expect, it } from "vitest";

import { compositionRows } from "@/features/categories/composition-rows";

it("ranks the groups of the last month and prints each share", () => {
  expect(
    compositionRows(
      [
        { field: "a", label: "Market" },
        { field: "b", label: "Diner" },
        { field: "c", label: "Bakery" },
      ],
      { a: 200, b: 600, c: 0, label: "Oct" },
      "en-US",
    ),
  ).toEqual([
    { label: "Diner · 75.00%", amount: 600 },
    { label: "Market · 25.00%", amount: 200 },
  ]);
});
