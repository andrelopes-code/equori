import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { KindPanel } from "@/features/accounts/kind-chooser/kind-panel";
import { catalogEn } from "@/i18n/catalog.en";
import { I18nProvider } from "@/i18n/i18n-provider";

describe("KindPanel", () => {
  it("states what a credit card asks and becomes", () => {
    const { container } = inEnglish(<KindPanel kind="credit_card" count={0} />);
    const panel = screen.getByRole("complementary");

    expect(panel).toHaveAttribute("aria-live", "polite");
    expect(
      within(panel).getByRole("heading", {
        name: catalogEn["kind.title.credit_card"],
      }),
    ).toBeInTheDocument();
    expect(panel).toHaveTextContent(catalogEn["kindPanel.liability"]);
    expect(panel).toHaveTextContent(catalogEn["kind.hint.credit_card"]);
    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      catalogEn["kindPanel.stepIdentity"],
      catalogEn["kindPanel.stepDetails"],
      catalogEn["accountForm.openingCard"],
      catalogEn["accountForm.billing"],
      catalogEn["accountForm.limitGroup"],
      catalogEn["accountForm.cards"],
    ]);
    expect(factOf(panel, catalogEn["kindPanel.opensIn"])).toBe(
      catalogEn["nav.cards"],
    );
    expect(factOf(panel, catalogEn["kindPanel.liquidity"])).toBe(
      catalogEn["kindPanel.no"],
    );
    expect(factOf(panel, catalogEn["kindPanel.cards"])).toBe(
      catalogEn["kindPanel.noCards"],
    );
    expect(container.querySelector("svg[data-enter]")).not.toBeNull();
  });

  it("marks the steps only a reserve has and counts one account", () => {
    inEnglish(<KindPanel kind="reserve" count={1} />);
    const panel = screen.getByRole("complementary");
    const own = within(panel)
      .getAllByRole("listitem")
      .filter((item) => item.hasAttribute("data-own"));

    expect(panel).toHaveTextContent(catalogEn["kindPanel.asset"]);
    expect(own.map((item) => item.textContent)).toEqual([
      catalogEn["accountForm.yield"],
    ]);
    expect(factOf(panel, catalogEn["kindPanel.liquidity"])).toBe(
      catalogEn["kindPanel.yes"],
    );
    expect(factOf(panel, catalogEn["kindPanel.accounts"])).toBe(
      catalogEn["kindPanel.countOne"],
    );
  });

  // KC7: a description of two sentences takes one line per sentence, so no line outgrows the panel.
  it("writes each sentence of the description on its own line", () => {
    inEnglish(<KindPanel kind="brokerage" count={2} />);
    const panel = screen.getByRole("complementary");
    const [first, second] = catalogEn["kind.hint.brokerage"].split(/(?<=\.) /);

    expect(within(panel).getByText(first ?? "")).toBeInTheDocument();
    expect(within(panel).getByText(second ?? "")).toBeInTheDocument();
  });

  // KC5: each kind mounts a new scene, so its entrance plays again.
  it("mounts a new scene when the kind changes", () => {
    const { container, rerender } = inEnglish(
      <KindPanel kind="checking" count={0} />,
    );
    const before = container.querySelector("svg[data-enter]");

    rerender(
      <I18nProvider locale={{ language: "en", region: "US" }}>
        <KindPanel kind="cash" count={0} />
      </I18nProvider>,
    );

    expect(container.querySelector("svg[data-enter]")).not.toBe(before);
  });

  it("wraps the cash step of a brokerage after the institution", () => {
    inEnglish(<KindPanel kind="brokerage" count={2} />);
    const items = within(screen.getByRole("complementary")).getAllByRole(
      "listitem",
    );

    expect(items.map((item) => item.textContent)).toContain(
      catalogEn["kindPanel.afterInstitution"].replace(
        "{step}",
        catalogEn["kindPanel.stepCashMode"],
      ),
    );
  });

  it("writes the count of several accounts", () => {
    inEnglish(<KindPanel kind="checking" count={4} />);

    expect(
      factOf(
        screen.getByRole("complementary"),
        catalogEn["kindPanel.accounts"],
      ),
    ).toBe(catalogEn["kindPanel.countMany"].replace("{count}", "4"));
  });

  it("invites a choice while no kind is chosen", () => {
    const { container } = inEnglish(<KindPanel kind={null} count={0} />);
    const panel = screen.getByRole("complementary");

    expect(panel).toHaveTextContent(catalogEn["kindPanel.emptyTitle"]);
    expect(panel).toHaveTextContent(catalogEn["kindPanel.emptyBody"]);
    expect(within(panel).queryAllByRole("listitem")).toHaveLength(0);
    expect(container.querySelector("svg[data-tone='neutral']")).not.toBeNull();
    expect(container.querySelector("svg[data-enter]")).toBeNull();
  });

  it("draws a scene that does not answer the pointer", () => {
    const { container } = inEnglish(<KindPanel kind="reserve" count={1} />);

    expect(container.querySelector("svg[data-interactive]")).toBeNull();
  });
});

function inEnglish(ui: ReactNode) {
  return render(
    <I18nProvider locale={{ language: "en", region: "US" }}>{ui}</I18nProvider>,
  );
}

function factOf(panel: HTMLElement, label: string): string | null {
  const row = within(panel).getByText(label).closest("[data-fact]");

  return row?.querySelector("[data-fact-value]")?.textContent ?? null;
}
