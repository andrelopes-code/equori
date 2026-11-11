import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { TransferCandidateList } from "@/features/accounts/transfer-candidates/transfer-candidate-list";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { formatSigned } from "@/i18n/format";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type ExternalRecord = components["schemas"]["ExternalRecord"];

const candidateID = "0198a000-0000-7000-8000-000000000001";

const record: ExternalRecord = {
  id: "0198a000-0000-7000-8000-000000000002",
  batch_id: "0198a000-0000-7000-8000-000000000003",
  account_id: "0198a000-0000-7000-8000-000000000004",
  date: "2026-10-16",
  amount: { amount: 25000, currency: "BRL" },
  description: "Pix recebido",
  state: "needs_review",
  review_reason: "transfer",
  candidates: [candidateID],
};

describe("TransferCandidateList", () => {
  it("shows the opposite posting of the candidate and matches it", async () => {
    const onMatch = vi.fn();
    const fetch = fakeApi({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          books_id: 1,
          role: "admin",
          language: "pt",
          region: "BR",
        }),
      [`GET /api/v1/transactions/${candidateID}`]: () =>
        json(200, {
          id: candidateID,
          date: "2026-10-16",
          description: "Pix enviado",
          postings: [
            {
              account_id: "0198a000-0000-7000-8000-000000000005",
              amount: { amount: -25000, currency: "BRL" },
            },
            {
              account_id: "0198a000-0000-7000-8000-000000000006",
              amount: { amount: 25000, currency: "BRL" },
            },
          ],
        }),
    });

    renderWithProviders(
      <TransferCandidateList
        record={record}
        scale={() => 2}
        pending={null}
        onMatch={onMatch}
      />,
      { fetch },
    );

    expect(await screen.findByText("Pix enviado")).toBeInTheDocument();
    const signed = formatSigned(
      { amount: -25000, currency: "BRL" },
      2,
      "pt-BR",
    );

    // The default matcher collapses the no-break space of the amount.
    expect(
      await screen.findByText((_, el) => el?.textContent === signed),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: catalogPtBR["batch.match"] }),
    );

    expect(onMatch).toHaveBeenCalledWith(candidateID);
  });
});
