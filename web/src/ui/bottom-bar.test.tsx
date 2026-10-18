import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n/i18n-provider";
import { BottomBar } from "@/ui/bottom-bar";
import styles from "@/ui/bottom-bar.module.css";

const css = readFileSync("src/ui/bottom-bar.module.css", "utf8");
const items = [
  { key: "home", label: "Home", to: "/" },
  {
    key: "transactions",
    label: "Transactions",
    to: "/transactions",
    badge: "3",
  },
  { key: "entry", label: "New", to: "/transactions/new", ink: true },
  { key: "accounts", label: "Accounts", to: "/accounts" },
  { key: "more", label: "More", onPress: () => undefined },
] as const;

async function renderBar(path: string) {
  const root = createRootRoute({
    component: () => <BottomBar items={items} />,
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
}

// Ledger sheet decision L5 and shell second pass S2: five text controls, one in ink; L8: the
// count beside Transactions.
describe("BottomBar", () => {
  it("marks Transactions current on a transaction detail route", async () => {
    await renderBar("/transactions/abc");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.querySelector("span")?.textContent);
    expect(current).toEqual(["Transactions"]);
  });

  it("marks Accounts current on its route", async () => {
    await renderBar("/accounts");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent);
    expect(current).toEqual(["Accounts"]);
  });

  it("renders five text controls in a navigation landmark, entry in ink", async () => {
    await renderBar("/");
    const bar = screen.getByRole("navigation", { name: "Main navigation" });
    expect(bar).toHaveAttribute("data-own", "bottom-bar");
    const controls = [...bar.querySelectorAll("a, button")];
    expect(controls).toHaveLength(5);
    expect(
      controls.filter((control) => control.hasAttribute("data-emphasis")),
    ).toEqual([screen.getByRole("link", { name: "New" })]);
    expect(bar.querySelector("svg")).toBeNull();
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
      .map((link) => link.querySelector("span"));
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
    const active = /\.control\[aria-current="page"\]\s*\{[^}]*\}/.exec(
      css,
    )?.[0];
    expect(active).toContain("color:");
    expect(active).toContain("border-block-start-color");
    expect(active).not.toContain("font-weight");
    expect(label).toContain("font-size: var(--slotted-font-size-xs)");
    expect(
      screen.getByRole("button", { name: "More" }).querySelector("span"),
    ).toHaveClass(styles.label ?? "label");
  });
});
