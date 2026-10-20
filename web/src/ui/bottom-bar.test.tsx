import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/i18n-provider";
import { BottomBar } from "@/ui/bottom-bar";
import styles from "@/ui/bottom-bar.module.css";

const css = readFileSync("src/ui/bottom-bar.module.css", "utf8");
const items = [
  { key: "home", label: "Home", to: "/", glyph: "home" },
  {
    key: "transactions",
    label: "Transactions",
    to: "/transactions",
    badge: "3",
    glyph: "list",
  },
  {
    key: "entry",
    label: "New",
    to: "/transactions/new",
    primary: true,
    glyph: "plus",
  },
  { key: "accounts", label: "Accounts", to: "/accounts", glyph: "card" },
  { key: "more", label: "More", onPress: () => undefined, glyph: "more" },
] as const;

async function renderBar(path: string, onReselect?: () => void) {
  const root = createRootRoute({
    component: () => (
      <BottomBar
        items={items}
        {...(onReselect === undefined ? {} : { onReselect })}
      />
    ),
  });
  const leaf = (leafPath: string) =>
    createRoute({ getParentRoute: () => root, path: leafPath });
  const router = createRouter({
    routeTree: root.addChildren([
      leaf("/"),
      leaf("/transactions"),
      leaf("/transactions/$id"),
      leaf("/transactions/new"),
      leaf("/accounts"),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <I18nProvider locale="en">
      <RouterProvider router={router} />
    </I18nProvider>,
  );
  await screen.findByRole("navigation", { name: "Main navigation" });
  return router;
}

// Five controls, a glyph over each label, the entry in the accent, the count on the
// Transactions glyph.
describe("BottomBar", () => {
  it("marks Transactions current on a transaction detail route", async () => {
    await renderBar("/transactions/abc");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map(
        (link) =>
          link.querySelector(`.${styles.label ?? "label"}`)?.textContent,
      );
    expect(current).toEqual(["Transactions"]);
  });

  it("marks Accounts current on its route", async () => {
    await renderBar("/accounts");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map(
        (link) =>
          link.querySelector(`.${styles.label ?? "label"}`)?.textContent,
      );
    expect(current).toEqual(["Accounts"]);
  });

  it("renders five controls with a glyph each in a navigation landmark, entry in the accent", async () => {
    await renderBar("/");
    const bar = screen.getByRole("navigation", { name: "Main navigation" });
    expect(bar).toHaveAttribute("data-own", "bottom-bar");
    const controls = [...bar.querySelectorAll("a, button")];
    expect(controls).toHaveLength(5);
    expect(
      controls.filter((control) => control.hasAttribute("data-emphasis")),
    ).toEqual([screen.getByRole("link", { name: "New" })]);
    expect(bar.querySelectorAll("svg")).toHaveLength(5);
    expect(
      controls.map((control) =>
        control.querySelector("svg")?.getAttribute("aria-hidden"),
      ),
    ).toEqual(["true", "true", "true", "true", "true"]);
  });

  it("shows the badge after its label", async () => {
    await renderBar("/");
    const link = screen.getByRole("link", { name: /^Transactions/ });
    expect(link.querySelector('[data-own="bar-count"]')).toHaveTextContent("3");
    expect(
      screen
        .getByRole("link", { name: "Home" })
        .querySelector('[data-own="bar-count"]'),
    ).toBeNull();
  });

  it("sets every label in the wrapping label style", async () => {
    await renderBar("/");
    const labels = screen
      .getAllByRole("link")
      .map((link) => link.querySelector(`.${styles.label ?? "label"}`));
    expect(labels).toHaveLength(4);
    for (const label of labels) {
      expect(label).toHaveClass(styles.label ?? "label");
    }
    expect(styles.label).toBeTruthy();
    const label = /\.label\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(label).not.toContain("text-overflow");
    expect(label).not.toContain("nowrap");
    for (const forbidden of ["break-all", "anywhere", "break-word"]) {
      expect(label).not.toContain(forbidden);
    }
    expect(label).toContain("hyphens: manual");
    expect(label).toContain("overflow-wrap: normal");
    const active = /\.control\[data-selected\]\s*\{[^}]*\}/.exec(css)?.[0];
    expect(active).toContain("color: var(--slotted-tone-accent-text)");
    expect(active).not.toContain("font-weight");
    expect(label).toContain("font-size: var(--slotted-font-size-xs)");
    expect(
      screen
        .getByRole("button", { name: "More" })
        .querySelector(`.${styles.label ?? "label"}`),
    ).toBeInTheDocument();
  });

  // The selection paints before the destination renders.
  it("selects the tapped tab before the route changes", async () => {
    const router = await renderBar("/");
    const transactions = screen.getByRole("link", { name: /^Transactions/ });
    fireEvent.click(transactions);
    expect(transactions).toHaveAttribute("data-selected");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "data-selected",
    );
    expect(router.state.location.pathname).toBe("/");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions");
    });
    expect(transactions).toHaveAttribute("aria-current", "page");
    expect(transactions).toHaveAttribute("data-selected");
  });

  it("leaves a modified click to the browser", async () => {
    const router = await renderBar("/");
    const transactions = screen.getByRole("link", { name: /^Transactions/ });
    expect(transactions).toHaveAttribute("href", "/transactions");
    fireEvent.click(transactions, { ctrlKey: true });
    expect(transactions).not.toHaveAttribute("data-selected");
    expect(router.state.location.pathname).toBe("/");
  });

  // Outline at rest, filled when selected.
  it("fills the selected tab's glyph and outlines the others", async () => {
    await renderBar("/");
    const variant = (name: string | RegExp) =>
      screen
        .getByRole("link", { name })
        .querySelector("svg")
        ?.getAttribute("data-variant");
    expect(variant("Home")).toBe("filled");
    expect(variant(/^Transactions/)).toBe("outline");
    expect(variant("Accounts")).toBe("outline");
  });

  // A tap on the selected destination at its own route asks for the top of the page.
  it("reports a tap on the selected tab at its own route", async () => {
    const onReselect = vi.fn();
    const router = await renderBar("/transactions", onReselect);
    fireEvent.click(screen.getByRole("link", { name: /^Transactions/ }));
    expect(onReselect).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/transactions");
  });

  it("returns to the destination's route from a route below it", async () => {
    const onReselect = vi.fn();
    const router = await renderBar("/transactions/abc", onReselect);
    fireEvent.click(screen.getByRole("link", { name: /^Transactions/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions");
    });
    expect(onReselect).not.toHaveBeenCalled();
  });

  // A translucent material with an opaque fallback.
  it("draws the bar as a blurred material with an opaque fallback", () => {
    const bar = /\.bar\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(bar).toContain("background: var(--slotted-surface)");
    expect(css).toContain("@supports (backdrop-filter: blur(1px))");
    expect(css).toContain("backdrop-filter:");
    expect(css).toContain("prefers-reduced-transparency: reduce");
  });
});
