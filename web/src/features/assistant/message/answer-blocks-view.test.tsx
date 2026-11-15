import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseAnswer } from "@/features/assistant/message/answer-markdown";
import { MessageAnswer } from "@/features/assistant/message/message-answer";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

const comparison = `Two months.

| Mês | Valor |
| --- | --- |
| Setembro | R$ 1.088,20 |
| Outubro | R$ 1.284,50 |

Done.`;

const ranking = `| Estabelecimento | Gasto |
| --- | --- |
| iFood | R$ 612,40 |
| Outback | R$ 389,00 |
| Padaria Real | R$ 283,10 |
| Rappi | R$ 0,00 |`;

const series = `| Data | Saldo |
| --- | --- |
| 15/11 | R$ 3.517,10 |
| 17/11 | R$ 598,72 |
| 22/11 | R$ 340,10 |`;

describe("MessageAnswer blocks", () => {
  // English texts with the decimal convention of the cells: group ".", decimal ",".
  beforeEach(() => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
  });

  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
  });

  it("draws a two-row table as a comparison with the difference", () => {
    renderAnswer(comparison);

    expect(
      screen.getByRole("img", {
        name: "Setembro: R$ 1.088,20; Outubro: R$ 1.284,50",
      }),
    ).toBeVisible();
    expect(screen.getByText("18% more")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Two months.")).toBeVisible();
    expect(screen.getByText("Done.")).toBeVisible();
  });

  it("numbers the rows of a descending ranking", () => {
    renderAnswer(ranking);

    for (const index of ["1", "2", "3", "4"]) {
      expect(screen.getByText(index)).toBeVisible();
    }
    expect(screen.getByText("Rappi")).toBeVisible();
    expect(screen.getByText("R$ 0,00")).toBeVisible();
  });

  it("writes the lowest point of a series", () => {
    renderAnswer(series);

    expect(screen.getByText("lowest R$ 340,10")).toBeInTheDocument();
  });

  it("keeps the table while amounts are hidden", () => {
    hideAmounts();
    renderAnswer(comparison);

    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("draws an answer without tables as Markdown", () => {
    renderAnswer("Two **rides**.");

    expect(screen.getByText("rides")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

function renderAnswer(source: string) {
  renderWithProviders(<MessageAnswer tree={parseAnswer(source)} />, {
    fetch: fakeApi({}),
  });
}
