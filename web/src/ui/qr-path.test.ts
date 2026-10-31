import { describe, expect, it } from "vitest";

import { qrPath } from "@/ui/qr-path";

describe("qrPath", () => {
  it.each([
    {
      name: "two dark modules",
      matrix: [
        [true, false],
        [false, true],
      ],
      want: "M0 0h1v1h-1zM1 1h1v1h-1z",
    },
    { name: "no dark module", matrix: [[false]], want: "" },
  ])("draws $name", ({ matrix, want }) => {
    expect(qrPath(matrix)).toBe(want);
  });
});
