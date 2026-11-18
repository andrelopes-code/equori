import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

// jsdom plays no media; the browser of these tests plays the videos of the help.
function plays(answer: CanPlayTypeResult) {
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue(answer);
}

beforeEach(() => {
  localStorage.clear();
  plays("probably");
});

function inRegion(region: string) {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "en", region }),
  );
}

describe("help", () => {
  // Spec 2026-11-17-help-design, HP1: the index follows the reader's questions, not the kinds.
  it("leads with the walkthrough, then the pages by area, the symptoms and the terms", async () => {
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
    expect(
      await screen.findByRole("link", { name: /Add your accounts/ }),
    ).toHaveAttribute("href", "/help/first-month#1-add-your-accounts");

    const cards = await screen.findByRole("list", {
      name: catalogEn["help.area.cards"],
    });
    const link = within(cards).getByRole("link", { name: /Pay a statement/ });
    expect(link).toHaveAttribute("href", "/help/pay-statement");
    expect(link).toHaveTextContent(catalogEn["help.media.video"]);
    expect(link).toHaveTextContent(catalogEn["help.kind.howto.short"]);

    expect(
      screen.getByRole("link", { name: "A connection reads Stalled" }),
    ).toHaveAttribute("href", "/help/troubleshooting#connection-stalled");
    expect(screen.getByRole("link", { name: "Category" })).toHaveAttribute(
      "href",
      "/help/glossary#category",
    );
  });

  it("searches by the address and draws the first result apart (HP9)", async () => {
    await renderApp("/help?q=statement", { fetch: fakeApi(sharedRoutes) });

    expect(await screen.findByRole("status")).toHaveTextContent(
      /^\d+ results for “statement”$/,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("statement");
    // The first page of the index whose title holds the word.
    const best = await screen.findByRole("link", {
      name: /^Import a statement/,
    });
    expect(best).toHaveAttribute("href", "/help/import-statement");
    expect(screen.getByRole("link", { name: "Send the file" })).toHaveAttribute(
      "href",
      "/help/import-statement#send-the-file",
    );
    expect(
      screen.getByRole("link", { name: /^Pay a statement/ }),
    ).toHaveAttribute("href", "/help/pay-statement");
    expect(
      screen.getByRole("list", { name: catalogEn["help.search.group.terms"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Your first month in equori" }),
    ).not.toBeInTheDocument();
    // The matched words are marked by the Highlight family.
    expect(best.querySelector('[data-ui="highlight"] mark')).toHaveTextContent(
      "statement",
    );
  });

  it("draws a glossary term as a word above its meaning, with its anchor", async () => {
    await renderApp("/help/glossary", { fetch: fakeApi(sharedRoutes) });

    const word = await screen.findByRole("heading", {
      level: 3,
      name: "Category",
    });

    expect(word.parentElement).toHaveAttribute("id", "category");
    expect(word.parentElement).toHaveTextContent(/Category.+expense/);
    expect(screen.queryByText(/^Category:/)).not.toBeInTheDocument();
  });

  it("moves through the results and opens one with the keys (HP10)", async () => {
    const user = userEvent.setup();
    await renderApp("/help", { fetch: fakeApi(sharedRoutes) });
    await screen.findByRole("link", { name: "Category" });

    await user.keyboard("/");
    const field = screen.getByRole("searchbox");
    expect(document.activeElement).toBe(field);

    await user.keyboard("glossry");
    await screen.findByRole("status");
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Glossary" }),
    ).toBeInTheDocument();
  });

  it("clears the search with Escape (HP10)", async () => {
    const user = userEvent.setup();
    await renderApp("/help?q=statement", { fetch: fakeApi(sharedRoutes) });
    await screen.findByRole("status");

    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(
      await screen.findByRole("heading", {
        name: "Your first month in equori",
      }),
    ).toBeInTheDocument();
  });

  it("answers a search without result with the assistant (HP11)", async () => {
    await renderApp("/help?q=zzzz", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByRole("heading", { name: "No page mentions “zzzz”" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(catalogEn["assistant.ask.title"]),
      }),
    ).toHaveTextContent("zzzz");
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

  // Spec 2026-11-17-help-design, HP1: the list of every page left the page view; the sections
  // and the neighbours stay.
  it("lists the sections of the page and leads on to its neighbours", async () => {
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    const sections = await screen.findByRole("navigation", {
      name: catalogEn["help.toc"],
    });
    expect(
      await within(sections).findByRole("link", {
        name: "Record the payment",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Check an account's balance" }),
    ).toHaveAttribute("href", "/help/check-balance");
    expect(
      screen.queryByRole("link", { name: "Glossary" }),
    ).not.toBeInTheDocument();
  });

  it("opens the screen of the task from the header (HP7)", async () => {
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByRole("link", { name: "Open Cards" }),
    ).toHaveAttribute("href", "/cards");
    expect(
      screen.getByRole("link", { name: catalogEn["help.search.label"] }),
    ).toHaveAttribute("href", "/help?q=");
  });

  it("shows the figure of the step chosen, with its count (HP5)", async () => {
    const user = userEvent.setup();
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    const step = await screen.findByRole("button", {
      name: /Choose how much to pay/,
    });
    expect(
      screen.getAllByAltText("The list of cards, with the card to open marked"),
    ).toHaveLength(2);

    await user.click(step);

    expect(step).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();
    expect(
      screen.getAllByAltText(
        "The payment dialog, with the Amount field marked",
      ),
    ).toHaveLength(2);
  });

  // Spec HP6, amended on 2026-11-18: the video waits behind its first figure and opens in a
  // player that grows over the page.
  it("opens the video of the steps in a player, only when asked (HP6)", async () => {
    const user = userEvent.setup();
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    await user.click(
      await screen.findByRole("radio", { name: /^Video · \d+ s$/ }),
    );
    expect(document.querySelector("video")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /^Watch the video · \d+ s$/ }),
    );

    const player = screen.getByRole("dialog", {
      name: "Video: the payment of a statement from start to end",
    });
    const video = player.querySelector("video");
    expect(video).toHaveAttribute("controls");
    expect(video?.muted).toBe(true);
    expect(video?.getAttribute("src")).toMatch(/pay-statement\.en\./);

    await user.click(
      within(player).getByRole("button", {
        name: catalogEn["help.video.close"],
      }),
    );
    expect(document.querySelector("video")).toBeNull();
  });

  // Owner, 2026-11-18: the player holds the steps the video shows, beside it.
  it("lists the steps of the video in the player", async () => {
    const user = userEvent.setup();
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    await user.click(
      await screen.findByRole("radio", { name: /^Video · \d+ s$/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /^Watch the video · \d+ s$/ }),
    );

    const player = screen.getByRole("dialog");
    const steps = within(player).getByRole("list", {
      name: catalogEn["help.video.steps"],
    });

    expect(within(steps).getAllByRole("listitem")).toHaveLength(5);
    expect(steps).toHaveTextContent("Choose how much to pay");
  });

  it("returns the focus to the button of the video when the player closes", async () => {
    const user = userEvent.setup();
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    await user.click(
      await screen.findByRole("radio", { name: /^Video · \d+ s$/ }),
    );
    const watch = screen.getByRole("button", {
      name: /^Watch the video · \d+ s$/,
    });
    await user.click(watch);
    await user.click(
      screen.getByRole("button", { name: catalogEn["help.video.close"] }),
    );

    await waitFor(() => {
      expect(document.querySelector("video")).toBeNull();
    });
    expect(watch).toHaveFocus();
  });

  // ADR 037: the steps and their figures are the content for a browser without WebM VP9.
  it("keeps the figures and offers no video to a browser that cannot play it", async () => {
    plays("");
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findAllByAltText(
        "The list of cards, with the card to open marked",
      ),
    ).toHaveLength(2);
    expect(screen.queryByRole("radio", { name: /^Video/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Watch the video/ }),
    ).toBeNull();
  });

  it("names no video in the index for a browser that cannot play it", async () => {
    plays("");
    await renderApp("/help", { fetch: fakeApi(sharedRoutes) });

    const cards = await screen.findByRole("list", {
      name: catalogEn["help.area.cards"],
    });
    // The title arrives with the library of the pages; the word would arrive with it.
    const link = await within(cards).findByRole("link", {
      name: /Pay a statement/,
    });

    expect(link).not.toHaveTextContent(catalogEn["help.media.video"]);
  });

  it("draws the figures of the reader's language", async () => {
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    const [figure] = await screen.findAllByAltText(
      "The list of cards, with the card to open marked",
    );

    expect(figure?.getAttribute("src")).toMatch(/pay-cards\.en\.dark/);
  });

  it("ends a task with its symptoms, the assistant and the related pages (HP16)", async () => {
    await renderApp("/help/pay-statement", { fetch: fakeApi(sharedRoutes) });

    const symptoms = await screen.findByRole("navigation", {
      name: catalogEn["help.after.symptoms"],
    });
    expect(
      await within(symptoms).findByRole("link", {
        name: /A statement amount differs from the institution's/,
      }),
    ).toHaveAttribute("href", "/help/troubleshooting#statement-differs");
    expect(
      screen.getByRole("button", {
        name: new RegExp(catalogEn["assistant.ask.title"]),
      }),
    ).toBeInTheDocument();
    const related = screen.getByRole("navigation", {
      name: catalogEn["help.after.related"],
    });
    expect(
      within(related).getByRole("link", { name: /The statement screen/ }),
    ).toHaveAttribute("href", "/help/statement");
  });

  it("draws each symptom as its cause, its steps and its pointer (HP15)", async () => {
    await renderApp("/help/troubleshooting", { fetch: fakeApi(sharedRoutes) });

    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "A statement amount differs from the institution's",
    });
    const section = heading.closest("section");
    if (!(section instanceof HTMLElement)) throw new Error("no section");

    expect(heading).toHaveAttribute("id", "statement-differs");
    expect(
      within(section).getByText(catalogEn["help.fix.cause"]),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(catalogEn["help.fix.steps"]),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: "The statement screen" }),
    ).toHaveAttribute("href", "/help/statement");
    expect(within(section).queryByText(/^More:/)).not.toBeInTheDocument();
  });

  it("follows each step with its figure below 1024 px of page (HP5)", async () => {
    await renderApp("/help/pay-statement", {
      width: 390,
      fetch: fakeApi(sharedRoutes),
    });

    await screen.findByRole("heading", { level: 1, name: "Pay a statement" });

    expect(
      await screen.findAllByAltText(
        "The payment dialog, with the account and the date marked",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /^Watch the video · \d+ s$/ }),
    ).toBeInTheDocument();
  });

  it("draws a page with its title and router links to screens and pages", async () => {
    // A page without figures: beside a figure a step is a button and holds no link (HP5).
    await renderApp("/help/portfolio", { fetch: fakeApi(sharedRoutes) });

    expect(
      await screen.findByRole("heading", { level: 1, name: "The portfolio" }),
    ).toBeInTheDocument();
    // The page's text, apart from the shell's navigation, which links the same screen.
    const text = [...document.querySelectorAll("article a")];
    expect(text.find((link) => link.textContent === "Quotes")).toHaveAttribute(
      "href",
      "/instruments",
    );
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
