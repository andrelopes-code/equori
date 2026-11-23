import { describe, expect, it } from "vitest";

import { changeCodeKey } from "@/features/assistant/proposal/change-code";

describe("changeCodeKey", () => {
  it.each([
    ["category_class", "expense", "assistant.value.class.expense"],
    ["class", "liability", "assistant.value.class.liability"],
    ["kind", "savings", "kind.title.savings"],
    ["kind", "other", "assistant.value.kind.other"],
    ["kind", "fixed_income", "instruments.type.fixed_income"],
    ["kind", "starts_with", "alias.match.starts_with"],
    ["kind", "income", "connection.investments.proposal.income"],
    ["status", "open difference", "assistant.value.open_difference"],
    ["status", "archived", "assistant.value.archived"],
    ["status", "hidden", "assistant.value.hidden"],
    [
      "status",
      "excluded from liquidity",
      "assistant.value.excluded_from_liquidity",
    ],
    [
      "status",
      "enabled, stops later rules",
      "assistant.value.enabled_stops_later_rules",
    ],
    ["role", "owner", "members.role.owner"],
    ["decision", "re_identified", "links.decision.re_identified"],
    ["source", "average_income", "plan.source.average_income"],
    [
      "counts_in",
      "the bucket that takes savings",
      "assistant.value.the_bucket_that_takes_savings",
    ],
    ["color", "none", "assistant.value.color.none"],
    ["scheme", "high-contrast", "scheme.high-contrast"],
    ["density", "compact", "density.compact"],
  ])("reads %s %s from the catalogue", (field, text, key) => {
    expect(changeCodeKey(field, text)).toBe(key);
  });

  it.each([
    ["name", "expense"],
    ["source", "extrato.csv"],
    ["status", "brand_new_state"],
    ["kind", "toString"],
  ])("leaves %s %s as written", (field, text) => {
    expect(changeCodeKey(field, text)).toBeUndefined();
  });
});
