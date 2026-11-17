import { expect, test } from "vitest";

import { cx } from "@/ui/cx";

test("cx joins the class names and drops the absent ones", () => {
  const joined = cx("a", false, undefined, null, "", "b");

  expect(joined).toBe("a b");
});
