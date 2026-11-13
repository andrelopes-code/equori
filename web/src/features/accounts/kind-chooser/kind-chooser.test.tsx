import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { KindChooser } from "@/features/accounts/kind-chooser/kind-chooser";
import { kindOrder } from "@/features/accounts/kind-chooser/kind-order";
import type { Kind } from "@/features/accounts/model/account-kinds";
import { catalogEn } from "@/i18n/catalog.en";
import { I18nProvider } from "@/i18n/i18n-provider";

const none = Object.fromEntries(kindOrder.map((kind) => [kind, 0])) as Record<
  Kind,
  number
>;

describe("KindChooser", () => {
  it("lists the eleven kinds in two groups in kind order", () => {
    inEnglish({ value: null });

    const have = group(catalogEn["kindChooser.assets"]);
    const owe = group(catalogEn["kindChooser.liabilities"]);

    expect(screen.getByRole("radiogroup")).toHaveAccessibleName(
      catalogEn["kindChooser.label"],
    );
    expect(within(have).getAllByRole("radio")).toHaveLength(8);
    expect(within(owe).getAllByRole("radio")).toHaveLength(3);
    expect(
      screen.getAllByRole("radio").map((radio) => radio.textContent),
    ).toEqual(kindOrder.map((kind) => catalogEn[`kind.title.${kind}`]));
  });

  // KC5: the scene of a tile answers the pointer and the focus; the panel's scene does not.
  it("draws every tile's scene as interactive", () => {
    inEnglish({ value: null });

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.querySelector("svg[data-interactive]")).not.toBeNull();
    }
  });

  it("checks no radio and tabs only to the first when no kind is chosen", () => {
    inEnglish({ value: null });

    const radios = screen.getAllByRole("radio");

    expect(radios.filter((r) => r.ariaChecked === "true")).toEqual([]);
    expect(
      radios.filter((r) => r.tabIndex === 0).map((r) => r.textContent),
    ).toEqual([catalogEn["kind.title.checking"]]);
  });

  it("checks the chosen kind and tabs only to it", () => {
    inEnglish({ value: "savings" });

    const radios = screen.getAllByRole("radio");

    expect(
      radios.filter((r) => r.ariaChecked === "true").map((r) => r.textContent),
    ).toEqual([catalogEn["kind.title.savings"]]);
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([
      screen.getByRole("radio", { name: catalogEn["kind.title.savings"] }),
    ]);
  });

  it("chooses the kind of a clicked tile", async () => {
    const { onChange } = inEnglish({ value: "checking" });

    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["kind.title.cash"] }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("cash");
  });

  it("moves the choice with the arrow keys and focuses the new tile", async () => {
    const { onChange } = inEnglish({ value: "checking" });

    screen
      .getByRole("radio", { name: catalogEn["kind.title.checking"] })
      .focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("cash");
    expect(
      screen.getByRole("radio", { name: catalogEn["kind.title.cash"] }),
    ).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");

    expect(onChange).toHaveBeenLastCalledWith("benefit");
  });

  it("does not choose past the last kind", async () => {
    const { onChange } = inEnglish({ value: "payable" });

    screen
      .getByRole("radio", { name: catalogEn["kind.title.payable"] })
      .focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("continues on Enter over the checked tile", async () => {
    const { onChange, onContinue } = inEnglish({ value: "checking" });

    screen
      .getByRole("radio", { name: catalogEn["kind.title.checking"] })
      .focus();
    await userEvent.keyboard("{Enter}");

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the count of a kind above zero and nothing at zero", () => {
    inEnglish({ value: null, counts: { ...none, cash: 2, checking: 1 } });

    expect(radio("cash")).toHaveTextContent(
      `${catalogEn["kind.title.cash"]}2 accounts`,
    );
    expect(radio("checking")).toHaveTextContent(
      `${catalogEn["kind.title.checking"]}1 account`,
    );
    expect(radio("wallet")).toHaveTextContent(
      new RegExp(`^${catalogEn["kind.title.wallet"]}$`),
    );
  });

  it("keeps focus on the tile a controlled parent checks", async () => {
    render(
      <I18nProvider locale={{ language: "en", region: "US" }}>
        <Controlled />
      </I18nProvider>,
    );

    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["kind.title.wallet"] }),
    );

    expect(radio("wallet")).toHaveAttribute("aria-checked", "true");
    expect(radio("wallet")).toHaveFocus();
  });
});

function Controlled() {
  const [value, setValue] = useState<Kind | null>(null);

  return (
    <KindChooser
      value={value}
      counts={none}
      onChange={setValue}
      onContinue={vi.fn()}
    />
  );
}

interface Options {
  value: Kind | null;
  counts?: Record<Kind, number>;
}

function inEnglish({ value, counts = none }: Options) {
  const onChange = vi.fn();
  const onContinue = vi.fn();

  render(
    <I18nProvider locale={{ language: "en", region: "US" }}>
      <KindChooser
        value={value}
        counts={counts}
        onChange={onChange}
        onContinue={onContinue}
      />
    </I18nProvider>,
  );

  return { onChange, onContinue };
}

function group(name: string) {
  return screen.getByRole("group", { name });
}

function radio(kind: Kind) {
  return screen.getByRole("radio", {
    name: new RegExp(catalogEn[`kind.title.${kind}`]),
  });
}
