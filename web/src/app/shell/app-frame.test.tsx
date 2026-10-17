import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";

const html = document.documentElement;

function newFetch() {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: "user-1", email: "owner@example.com" }),
  });
}

beforeEach(() => {
  localStorage.clear();
  html.removeAttribute("lang");
  html.removeAttribute("data-slotted-density");
  html.removeAttribute("data-slotted-scheme");
});

describe("AppFrame navigation", () => {
  it("shows the bottom bar at 360 px", async () => {
    const { container } = await renderApp("/", {
      width: 360,
      fetch: newFetch(),
    });
    const bar = container.querySelector('[data-own="bottom-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.querySelectorAll("a, button")).toHaveLength(5);
    expect(document.querySelector('[data-ui="side-navigation"]')).toBeNull();
    expect(html).toHaveAttribute("data-slotted-density", "comfortable");
  });

  it("shows the side navigation rail at 768 px", async () => {
    const { container } = await renderApp("/", {
      width: 768,
      fetch: newFetch(),
    });
    const nav = container.querySelector('[data-ui="side-navigation"]');
    expect(nav).toHaveAttribute("data-mode", "compact");
    expect(container.querySelector('[data-own="bottom-bar"]')).toBeNull();
    expect(html).toHaveAttribute("data-slotted-density", "comfortable");
  });

  it("shows the expanded side navigation at 1280 px", async () => {
    const { container } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    const nav = container.querySelector('[data-ui="side-navigation"]');
    expect(nav).toHaveAttribute("data-mode", "expanded");
    expect(container.querySelector('[data-own="bottom-bar"]')).toBeNull();
    expect(html).toHaveAttribute("data-slotted-density", "compact");
  });

  it("swaps the bottom bar for the side navigation without a reload", async () => {
    const { container } = await renderApp("/", {
      width: 360,
      fetch: newFetch(),
    });
    expect(container.querySelector('[data-own="bottom-bar"]')).not.toBeNull();
    act(() => {
      setViewport(1280);
    });
    await waitFor(() => {
      expect(container.querySelector('[data-own="bottom-bar"]')).toBeNull();
    });
    expect(
      container.querySelector('[data-ui="side-navigation"]'),
    ).toHaveAttribute("data-mode", "expanded");
  });
});

describe("AppFrame routing", () => {
  it("navigates from the side navigation without a reload", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", {
      width: 1280,
      fetch: newFetch(),
    });
    await user.click(
      screen.getByRole("link", { name: catalogEn["nav.accounts"] }),
    );
    expect(router.state.location.pathname).toBe("/accounts");
  });

  it("marks Transactions current on a transaction detail route", async () => {
    await renderApp("/transactions/abc", { width: 1280, fetch: newFetch() });
    expect(
      screen.getByRole("link", { name: catalogEn["nav.transactions"] }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: catalogEn["nav.home"] }),
    ).not.toHaveAttribute("aria-current");
  });

  it("opens settings from the more sheet", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.settings"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings");
    });
  });
});

describe("AppFrame more sheet", () => {
  it("lists settings, colour scheme, language and log out", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      catalogEn["more.settings"],
      catalogEn["more.scheme"],
      catalogEn["more.language"],
      catalogEn["more.logout"],
    ]);
  });

  it("applies the chosen colour scheme", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.scheme"] }),
    );
    const options = await screen.findAllByRole("menuitem");
    expect(options.map((item) => item.textContent)).toEqual([
      catalogEn["scheme.dark"],
      catalogEn["scheme.light"],
      catalogEn["scheme.system"],
    ]);
    await user.click(
      screen.getByRole("menuitem", { name: catalogEn["scheme.light"] }),
    );
    expect(html).toHaveAttribute("data-slotted-scheme", "light");
  });

  it("switches the language to pt-BR", async () => {
    const user = userEvent.setup();
    await renderApp("/", { width: 360, fetch: newFetch() });
    await user.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.language"] }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: catalogEn["locale.pt-BR"] }),
    );
    expect(html).toHaveAttribute("lang", "pt-BR");
    expect(
      await screen.findByRole("navigation", {
        name: catalogPtBR["nav.label"],
      }),
    ).toBeInTheDocument();
  });
});

describe("AppProviders locale", () => {
  it("sets html lang from the stored locale on first load", async () => {
    localStorage.setItem("equori.locale", "pt-BR");
    await renderApp("/", { width: 360, fetch: newFetch() });
    expect(html).toHaveAttribute("lang", "pt-BR");
  });

  it("sets html lang to en when no locale is stored", async () => {
    await renderApp("/", { width: 360, fetch: newFetch() });
    expect(html).toHaveAttribute("lang", "en");
  });
});
