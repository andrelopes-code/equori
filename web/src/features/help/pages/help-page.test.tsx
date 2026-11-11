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
  it("leads with the walkthrough and lists the other pages by kind", async () => {
    await renderApp("/help", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Your first month in equori",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["help.start"] }),
    ).toHaveAttribute("href", "/help/first-month");

    const howTo = screen.getByRole("list", {
      name: catalogEn["help.kind.howto"],
    });
    const link = await within(howTo).findByRole("link", {
      name: /Pay a statement/,
    });
    expect(link).toHaveAttribute("href", "/help/pay-statement");
    expect(link).toHaveTextContent("A statement gathers the purchases");
  });

  it("states the page's kind in its header and its lead above the text", async () => {
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    const title = await screen.findByRole("heading", {
      level: 1,
      name: "Pay a statement",
    });
    const header = title.closest('[data-ui="page-header"]');
    if (!(header instanceof HTMLElement)) throw new Error("no page header");

    expect(
      within(header).getByText(catalogEn["help.kind.howto"]),
    ).toBeInTheDocument();
    expect(
      within(header).queryByText(/A statement gathers the purchases/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/A statement gathers the purchases/),
    ).toBeInTheDocument();
  });

  it("marks the page on show in the pages beside it, and leads on to its neighbours", async () => {
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    const pages = await screen.findByRole("navigation", {
      name: catalogEn["help.contents"],
    });
    expect(
      await within(pages).findByRole("link", { name: "Pay a statement" }),
    ).toHaveAttribute("aria-current", "page");
    // The next page, outside the pages beside it: the pager's.
    const next = (
      await screen.findAllByRole("link", { name: "Check an account's balance" })
    ).filter((link) => !pages.contains(link));
    expect(next).toHaveLength(1);
    expect(next[0]).toHaveAttribute("href", "/help/check-balance");
    expect(
      screen.getByRole("navigation", { name: catalogEn["help.toc"] }),
    ).toBeInTheDocument();
  });

  it("draws a page with its title and router links to screens and pages", async () => {
    await renderApp("/help/check-balance", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Check an account's balance",
      }),
    ).toBeInTheDocument();
    // The page's text, apart from the shell's navigation, which links the same screen.
    const text = [...document.querySelectorAll('[data-ui="markdown"]')].flatMap(
      (region) => [...region.querySelectorAll("a")],
    );
    expect(
      text.find((link) => link.textContent === "Accounts"),
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

  // ADR 027, S3: the help is a phone route, so a statement read on a phone reaches its page.
  it("draws a page below 600 px", async () => {
    await renderApp("/help/statement", {
      width: 390,
      fetch: fakeApi(sharedRoutes),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "The statement screen",
      }),
    ).toBeInTheDocument();
  });

  it("answers an unknown page with the not-found screen", async () => {
    await renderApp("/help/nope", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByText(catalogEn["common.notFound.title"]),
    ).toBeInTheDocument();
  });
});
