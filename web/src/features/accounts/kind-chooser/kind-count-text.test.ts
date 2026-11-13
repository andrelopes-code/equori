import { describe, expect, it } from "vitest";

import { kindCountText } from "@/features/accounts/kind-chooser/kind-count-text";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key, vars = {}) =>
  Object.entries(vars).reduce<string>(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    catalogEn[key],
  );

describe("kindCountText", () => {
  it.each([
    [1, "1 account"],
    [2, "2 accounts"],
    [1234, "1,234 accounts"],
  ] as const)("writes %i as %s", (count, text) => {
    expect(kindCountText(t, "en", count)).toBe(text);
  });
});
