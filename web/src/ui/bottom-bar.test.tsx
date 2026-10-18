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
const icon = <svg aria-hidden="true" />;

const items = [
  { key: "home", label: "Home", icon, to: "/" },
  { key: "transactions", label: "Transactions", icon, to: "/transactions" },
  {
    key: "new",
    label: "New",
    icon,
    to: "/transactions/new",
    emphasized: true,
  },
  { key: "accounts", label: "Accounts", icon, to: "/accounts" },
  { key: "more", label: "More", icon, onPress: () => undefined },
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
      leaf("/transactions/new"),
      leaf("/transactions/$id"),
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

describe("BottomBar", () => {
  it("marks the centre item current only on its own route", async () => {
    await renderBar("/transactions/new");
    expect(screen.getByRole("link", { name: "New" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks only New current on the new transaction route", async () => {
    await renderBar("/transactions/new");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent);
    expect(current).toEqual(["New"]);
  });

  it("marks Transactions current on a transaction detail route", async () => {
    await renderBar("/transactions/abc");
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent);
    expect(current).toEqual(["Transactions"]);
  });

  it("leaves the centre item without aria-current on another route", async () => {
    await renderBar("/accounts");
    expect(screen.getByRole("link", { name: "New" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("flags only the emphasized item", async () => {
    await renderBar("/");
    expect(screen.getByRole("link", { name: "New" })).toHaveAttribute(
      "data-emphasized",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "data-emphasized",
    );
    expect(screen.getByRole("button", { name: "More" })).not.toHaveAttribute(
      "data-emphasized",
    );
  });

  it("renders five controls in a navigation landmark", async () => {
    await renderBar("/");
    const bar = screen.getByRole("navigation", { name: "Main navigation" });
    expect(bar).toHaveAttribute("data-own", "bottom-bar");
    expect(bar.querySelectorAll("a, button")).toHaveLength(5);
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
    expect(label).toContain("hyphens: auto");
    expect(label).toContain("font-size: calc(var(--slotted-font-size-xs)");
    expect(
      screen.getByRole("button", { name: "More" }).querySelector("span"),
    ).toHaveClass(styles.label ?? "label");
  });
});
