import { screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountRowStatus } from "@/features/accounts/account-mark/account-row-status";
import { reconciliationQuery } from "@/features/accounts/api";
import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  cardID,
  checkingID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Account = components["schemas"]["Account"];

describe("AccountRowStatus", () => {
  it("AL11: draws nothing for a card whose reconciliation another screen read", async () => {
    renderStatus(cardID);

    await screen.findByText("read");

    expect(
      screen.queryByText(catalogEn["reconciliation.tag.never"]),
    ).not.toBeInTheDocument();
  });

  it("says that a checking account was never reconciled", async () => {
    renderStatus(checkingID);

    await screen.findByText("read");

    expect(
      screen.getByText(catalogEn["reconciliation.tag.never"]),
    ).toBeInTheDocument();
  });
});

function renderStatus(id: string) {
  const account = accountFixtures.find((a) => a.id === id) as Account;

  renderWithProviders(
    <>
      <OtherReader id={id} />
      <AccountRowStatus account={account} scale={() => 2} quiet />
    </>,
    {
      fetch: fakeApi(
        accountRoutes({
          [`GET /api/v1/accounts/${id}/reconciliation`]: () => json(200, {}),
        }),
      ),
    },
  );
}

// Stands for the attention list of the overview, which reads every open account.
function OtherReader({ id }: { id: string }) {
  const status = useQuery(reconciliationQuery(useApi(), id));

  return status.data === undefined ? null : "read";
}
