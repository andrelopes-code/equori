import { describe, expect, it } from "vitest";

import { linkHref } from "@/features/assistant/view/link-href";

describe("linkHref", () => {
  it("adds the filters as the query", () => {
    expect(
      linkHref({
        screen: "/reports",
        params: { from: "2026-10-01", to: "2026-10-31" },
      }),
    ).toBe("/reports?from=2026-10-01&to=2026-10-31");
  });

  it("keeps a bare path", () => {
    expect(linkHref({ screen: "/imports" })).toBe("/imports");
  });
});
