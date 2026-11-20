import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ConditionValue } from "@/features/categories/rule-editor/condition-value";
import { catalogEn } from "@/i18n/catalog.en";
import { I18nProvider } from "@/i18n/i18n-provider";

describe("ConditionValue", () => {
  // Property account design PA1 (A259): a rule condition names the kind property.
  it("offers the kind property for an account kind condition", async () => {
    render(
      <I18nProvider locale={{ language: "en", region: "US" }}>
        <ConditionValue
          condition={{
            field: "account_kind",
            operator: "equals",
            value: "checking",
          }}
          onChange={() => undefined}
          payees={[]}
          accounts={[]}
          currency="BRL"
          scale={2}
          invalid={false}
        />
      </I18nProvider>,
    );

    await userEvent.click(screen.getByRole("combobox"));

    expect(
      await screen.findByRole("option", { name: catalogEn["kind.property"] }),
    ).toBeInTheDocument();
  });
});
