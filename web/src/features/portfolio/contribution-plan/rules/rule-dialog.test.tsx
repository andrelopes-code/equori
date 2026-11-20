import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  byRuleDraft,
  previewRoute,
} from "@/features/portfolio/contribution-plan/rules/rule-fixtures";
import { RuleDialog } from "@/features/portfolio/contribution-plan/rules/rule-dialog";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const word = (key: keyof typeof catalogEn) => catalogEn[key];

function setup(subtypes: string[] = []) {
  const onSave = vi.fn();
  const fetch = fakeApi({
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/instrument-subtypes": () => json(200, { items: subtypes }),
    "POST /api/v1/contribution-plan/preview": previewRoute,
  });

  renderWithProviders(
    <RuleDialog
      name="Pós"
      draft={byRuleDraft([])}
      index={0}
      onSave={onSave}
      onClose={() => undefined}
    />,
    { fetch },
  );

  return { onSave, user: userEvent.setup() };
}

describe("RuleDialog", () => {
  it("saves the rule of the chosen conditions", async () => {
    const { onSave, user } = setup();

    await user.click(
      await screen.findByRole("combobox", {
        name: word("contributionPlan.rule.dialog.type"),
      }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Fixed income" }),
    );
    await user.click(
      await screen.findByRole("radio", {
        name: catalogEn["fixedIncome.kind.inflation"],
      }),
    );
    await user.type(
      screen.getByRole("spinbutton", {
        name: /^From/,
      }),
      "2031",
    );
    await user.type(
      screen.getByRole("spinbutton", {
        name: /^To/,
      }),
      "2035",
    );
    await user.click(
      screen.getByRole("button", {
        name: word("contributionPlan.rule.dialog.save"),
      }),
    );

    expect(onSave).toHaveBeenCalledWith({
      instrument_type: "fixed_income",
      return_kind: "inflation",
      matures_from_year: 2031,
      matures_to_year: 2035,
    });
  });

  it("picks the subtypes in one select of many choices", async () => {
    const { onSave, user } = setup(["cdb", "lci"]);

    await user.click(
      await screen.findByRole("combobox", {
        name: word("contributionPlan.rule.dialog.type"),
      }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Fixed income" }),
    );
    await user.click(
      await screen.findByRole("combobox", {
        name: word("contributionPlan.rule.dialog.subtypes"),
      }),
    );
    await user.click(await screen.findByRole("option", { name: "cdb" }));
    await user.click(screen.getByRole("option", { name: "lci" }));
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("button", {
        name: word("contributionPlan.rule.dialog.save"),
      }),
    );

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(onSave).toHaveBeenCalledWith({
      instrument_type: "fixed_income",
      subtypes: ["cdb", "lci"],
    });
  });

  it("disables the save while every choice is any", async () => {
    setup();

    const save = await screen.findByRole("button", {
      name: word("contributionPlan.rule.dialog.save"),
    });

    expect(save).toBeDisabled();
    expect(
      screen.getByText(word("contributionPlan.rule.dialog.needCondition")),
    ).toBeVisible();
  });

  it("names the order of the years when the last comes before the first", async () => {
    const { user } = setup();

    await user.type(
      await screen.findByRole("spinbutton", {
        name: /^From/,
      }),
      "2035",
    );
    await user.type(
      screen.getByRole("spinbutton", {
        name: /^To/,
      }),
      "2030",
    );

    expect(
      await screen.findByText(word("contributionPlan.rule.dialog.yearOrder")),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: word("contributionPlan.rule.dialog.save"),
      }),
    ).toBeDisabled();
  });

  it("writes the securities that join the group today", async () => {
    setup();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("combobox", {
        name: word("contributionPlan.rule.dialog.type"),
      }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Fixed income" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Joins this group today: 1 asset/)).toBeVisible();
    });
  });
});
