import { List } from "@slotted/react/list";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { StatementItem } from "@/ui/statement/statement-item";

function renderItem(flag: string | undefined) {
  renderWithProviders(
    <List aria-label="Statement">
      <StatementItem
        mark={undefined}
        title="Padaria"
        struck={false}
        flag={flag}
        detail="Mercado · Nubank"
        amount="−R$ 12,00"
        note={undefined}
        onOpen={() => undefined}
        selection={undefined}
      />
    </List>,
    { fetch: fakeApi({}) },
  );
}

describe("StatementItem", () => {
  it("writes the detail alone when no state is flagged", () => {
    renderItem(undefined);

    expect(screen.getByText("Mercado · Nubank")).toBeInTheDocument();
  });

  it("writes the flag, a separator and the detail", () => {
    renderItem("Pending");

    expect(screen.getByText(/Pending · Mercado · Nubank/)).toBeInTheDocument();
  });
});
