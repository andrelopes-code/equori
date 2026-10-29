import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

beforeEach(() => {
  localStorage.clear();
});

function inRegion(region: string) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "en", region }),
  );
}

describe("help", () => {
  it("lists the pages by kind, each with its title and lead", async () => {
    await renderApp("/help", { fetch: fakeApi(sharedRoutes) });

    const howTo = await screen.findByRole("region", {
      name: catalogEn["help.kind.howto"],
    });
    const link = await within(howTo).findByRole("link", {
      name: /Pay a statement/,
    });

    expect(link).toHaveAttribute("href", "/help/pay-statement");
    expect(link).toHaveTextContent("A statement gathers the purchases");
  });

  it("draws a page with its title and router links to screens and pages", async () => {
    await renderApp("/help/check-balance", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Check an account's balance",
      }),
    ).toBeInTheDocument();
    const text = document.querySelector('[data-ui="markdown"]');
    expect(text).not.toBeNull();
    expect(
      within(text as HTMLElement).getByRole("link", { name: "Accounts" }),
    ).toHaveAttribute("href", "/accounts");
  });

  it("adds the passage of the reader's region", async () => {
    inRegion("BR");

    await renderApp("/help/bank-connections", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByRole("heading", { name: "In Brazil" }),
    ).toBeInTheDocument();
  });

  it("leaves the passage out in another region", async () => {
    inRegion("PT");

    await renderApp("/help/bank-connections", { fetch: fakeApi(sharedRoutes) });

    await screen.findByRole("heading", { level: 1, name: "Bank connections" });

    expect(
      screen.queryByRole("heading", { name: "In Brazil" }),
    ).not.toBeInTheDocument();
  });

  it("answers an unknown page with the not-found screen", async () => {
    await renderApp("/help/nope", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByText(catalogEn["common.notFound.title"]),
    ).toBeInTheDocument();
  });
});
