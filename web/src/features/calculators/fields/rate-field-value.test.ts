import { describe, expect, it } from "vitest";

import { rateFieldValue } from "@/features/calculators/fields/rate-field-value";

describe("rateFieldValue", () => {
  it.each([
    {
      name: "a dot becomes the comma of pt-BR",
      text: "11.5",
      tag: "pt-BR",
      want: "11,5",
    },
    {
      name: "a comma stays in pt-BR",
      text: "11,5",
      tag: "pt-BR",
      want: "11,5",
    },
    { name: "a dot stays in en", text: "11.5", tag: "en", want: "11.5" },
    {
      name: "a trailing dot is kept as typed",
      text: "11.",
      tag: "pt-BR",
      want: "11,",
    },
    { name: "no text is empty", text: undefined, tag: "pt-BR", want: "" },
  ])("$name", ({ text, tag, want }) => {
    expect(rateFieldValue(text, tag)).toBe(want);
  });
});
