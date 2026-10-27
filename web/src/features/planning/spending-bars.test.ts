import { expect, it } from "vitest";

import { spendingBars } from "@/features/planning/spending-bars";

it("ranks the spending and prints each share", () => {
  expect(
    spendingBars(
      [
        { name: "Food", spent: 100 },
        { name: "Rent", spent: 300 },
        { name: "Gifts", spent: 0 },
      ],
      "en-US",
    ),
  ).toEqual([
    { label: "Rent · 75.00%", spent: 300 },
    { label: "Food · 25.00%", spent: 100 },
  ]);
});
