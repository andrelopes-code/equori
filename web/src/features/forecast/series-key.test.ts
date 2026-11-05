import { describe, expect, it } from "vitest";

import { seriesKey } from "@/features/forecast/series-key";

describe("series key", () => {
  it.each([
    { payee: "p1", description: "Cea 1/3", want: "food|p:p1" },
    { payee: undefined, description: "Cea 3/3", want: "food|d:cea" },
    {
      payee: undefined,
      description: "Pix enviado Ruth 12/10",
      want: "food|d:pix enviado ruth",
    },
    {
      payee: undefined,
      description: "  Padaria São João #42 ",
      want: "food|d:padaria são joão",
    },
  ])("keys $description by $want", ({ payee, description, want }) => {
    expect(seriesKey("food", payee, description)).toBe(want);
  });
});
