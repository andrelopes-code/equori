import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { MASK } from "@/privacy/mask";
import { problem } from "@/testing/fake-api";
import {
  cardID,
  foreignApi as api,
  taxesID,
  travelID,
} from "@/testing/foreign-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { txID } from "@/testing/transaction-api";

const path = `/transactions/new?kind=foreign_purchase&account_id=${cardID}`;

async function type(label: string, text: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: label }),
    text,
  );
}

async function pickCategory(text: string) {
  const input = await screen.findByRole("combobox", {
    name: catalogEn["foreignPurchase.category"],
  });
  await userEvent.click(input);
  await userEvent.type(input, text);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
}

async function chooseCurrency(code: string) {
  await userEvent.click(
    await screen.findByRole("combobox", {
      name: catalogEn["foreignPurchase.currency"],
    }),
  );
  await userEvent.click(await screen.findByRole("option", { name: code }));
}

async function fillS16() {
  await chooseCurrency("USD");
  await type(catalogEn["foreignPurchase.original"], "10000");
  await userEvent.clear(
    await screen.findByRole("textbox", {
      name: catalogEn["foreignPurchase.rate"],
    }),
  );
  await type(catalogEn["foreignPurchase.rate"], "5.4830");
  await pickCategory("Travel");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("foreign purchase entry", () => {
  it("opens from the entry picker", async () => {
    await renderApp("/transactions/new", { fetch: api([]) });
    await userEvent.click(
      await screen.findByRole("radio", {
        name: catalogEn["entry.kind.foreign_purchase"],
      }),
    );
    expect(
      await screen.findByRole("combobox", {
        name: catalogEn["foreignPurchase.currency"],
      }),
    ).toBeInTheDocument();
  });

  it("offers only credit cards in the base currency", async () => {
    await renderApp("/transactions/new?kind=foreign_purchase", {
      fetch: api([]),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["foreignPurchase.card"]),
      }),
    );
    const radios = await screen.findAllByRole("radio", {
      name: /Itau|Dollar|Reserva|Wise/,
    });
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([
      cardID,
    ]);
  });

  it("offers the currencies other than the base", async () => {
    await renderApp(path, { fetch: api([]) });
    await userEvent.click(
      await screen.findByRole("combobox", {
        name: catalogEn["foreignPurchase.currency"],
      }),
    );
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["EUR", "USD"]);
  });

  it("prefills the charge of the card and lets it change", async () => {
    await renderApp(path, { fetch: api([]) });
    const field = await screen.findByRole("textbox", {
      name: catalogEn["foreignPurchase.chargeRate"],
    });
    await waitFor(() => {
      expect(field).toHaveValue("350");
    });
    await userEvent.clear(field);
    await userEvent.type(field, "100");
    expect(field).toHaveValue("100");
  });

  it("suggests the stored price with its source and accepts an override", async () => {
    await renderApp(path, { fetch: api([], { price: "5.4000" }) });
    await chooseCurrency("USD");
    const rate = await screen.findByRole("textbox", {
      name: catalogEn["foreignPurchase.rate"],
    });
    await waitFor(() => {
      expect(rate).toHaveValue("5.4000");
    });
    expect(screen.getByText(/ecb/i)).toBeInTheDocument();
    await userEvent.clear(rate);
    await userEvent.type(rate, "5.4830");
    expect(rate).toHaveValue("5.4830");
  });

  it("leaves the rate empty and says so when no price is stored", async () => {
    await renderApp(path, { fetch: api([]) });
    await chooseCurrency("USD");
    expect(
      await screen.findByText(
        catalogEn["foreignPurchase.rateMissing"]
          .replace("{currency}", "USD")
          .replace("{date}", "10/17/2026"),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: catalogEn["foreignPurchase.rate"] }),
    ).toHaveValue("");
  });

  // S16: 100.00 USD at 5.4830 with a charge of 350 bp is 548.30 plus 19.19, billed in 2026-11.
  it("shows the converted amount, the charge and the total of S16", async () => {
    await renderApp(path, { fetch: api([]) });
    await fillS16();
    const result = await screen.findByRole("region", {
      name: catalogEn["foreignPurchase.result"],
    });
    expect(within(result).getByText(/548\.30/)).toBeInTheDocument();
    expect(within(result).getByText(/19\.19/)).toBeInTheDocument();
    expect(within(result).getByText(/567\.49/)).toBeInTheDocument();
  });

  it("previews the statement the purchase is billed on", async () => {
    await renderApp(path, { fetch: api([]) });
    expect(await screen.findByText(/November 2026/)).toBeInTheDocument();
  });

  it("sends the body of the contract", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, { fetch: api(sent) });
    await fillS16();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          account_id: cardID,
          category_id: travelID,
          date: "2026-10-17",
          original: { amount: 10000, currency: "USD" },
          rate: "5.4830",
          foreign_charge_rate_bp: 350,
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  it("sends the category of the charge when one is chosen", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await fillS16();
    const input = await screen.findByRole("combobox", {
      name: catalogEn["foreignPurchase.chargeCategory"],
    });
    await userEvent.click(input);
    await userEvent.type(input, "Taxes");
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toMatchObject([{ foreign_charge_category_id: taxesID }]);
    });
  });

  it("shows the problem of the server on its field", async () => {
    await renderApp(path, {
      fetch: api([], {
        answer: () =>
          problem(422, "validation_failed", {
            errors: [{ field: "rate", message: "Rate not accepted." }],
          }),
      }),
    });
    await fillS16();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(await screen.findByText("Rate not accepted.")).toBeInTheDocument();
  });

  it("keeps an incomplete entry out of the API", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(
      await screen.findByText(catalogEn["foreignPurchase.required.currency"]),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("masks the amounts of the result when privacy mode hides them", async () => {
    hideAmounts();
    await renderApp(path, { fetch: api([]) });
    await fillS16();
    // The field being typed shows its own value; the result is what privacy mode masks.
    const result = await screen.findByRole("region", {
      name: catalogEn["foreignPurchase.result"],
    });
    await screen.findAllByText(new RegExp(MASK));
    expectNoAmounts(result, ["548.30", "19.19", "567.49"]);
    expect(
      screen.getByRole("textbox", { name: catalogEn["foreignPurchase.rate"] }),
    ).toHaveValue("5.4830");
  });

  it("holds no Brazilian value in a region with another base currency and no charge", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const sent: unknown[] = [];
    const { container } = await renderApp(path, {
      fetch: api(sent, { base: "EUR", chargeBP: 0, price: "1.0800" }),
    });
    await chooseCurrency("USD");
    await type(catalogEn["foreignPurchase.original"], "10000");
    await pickCategory("Travel");
    const result = await screen.findByRole("region", {
      name: catalogEn["foreignPurchase.result"],
    });
    await waitFor(() => {
      expect(within(result).getAllByText("€108.00")).toHaveLength(2);
    });
    expect(within(result).getByText("€0.00")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/R\$|BRL|IOF|350/);
  });
});
