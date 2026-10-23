import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, money, reserveID } from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

function api(sent: unknown[], reply?: () => Response) {
  return fakeApi(
    accountRoutes({
      "POST /api/v1/goals": async (req) => {
        sent.push(await req.json());
        return reply?.() ?? json(201, {});
      },
    }),
  );
}

async function openDialog() {
  await userEvent.click(
    await screen.findByRole("button", { name: catalogEn["goals.new"] }),
  );
  return screen.findByRole("dialog", { name: catalogEn["goals.new"] });
}

describe("GoalDialog", () => {
  it("creates a goal over the chosen account, due a year from today by default", async () => {
    const sent: unknown[] = [];
    await renderApp("/goals", { fetch: api(sent) });
    const dialog = await openDialog();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: catalogEn["goals.name"] }),
      "Emergency fund",
    );
    await userEvent.type(
      await within(dialog).findByRole("textbox", {
        name: catalogEn["goals.target"],
      }),
      "3000000",
    );
    await userEvent.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["goals.accounts"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /Reserva de emergência/u }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["goals.create"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          name: "Emergency fund",
          target: money(3000000),
          due_on: "2027-10-17",
          account_ids: [reserveID],
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("asks for a name, an amount and an account before sending", async () => {
    const sent: unknown[] = [];
    await renderApp("/goals", { fetch: api(sent) });
    const dialog = await openDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["goals.create"] }),
    );
    expect(
      await within(dialog).findByText(catalogEn["goals.problem.name"]),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(catalogEn["goals.problem.target"]),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(catalogEn["goals.problem.accounts"]),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("shows the problem the server returns and keeps the dialog open", async () => {
    const sent: unknown[] = [];
    await renderApp("/goals", {
      fetch: api(sent, () => problem(422, "invalid_account")),
    });
    const dialog = await openDialog();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: catalogEn["goals.name"] }),
      "Trip",
    );
    await userEvent.type(
      await within(dialog).findByRole("textbox", {
        name: catalogEn["goals.target"],
      }),
      "100000",
    );
    await userEvent.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["goals.accounts"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /Reserva de emergência/u }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["goals.create"] }),
    );
    expect(
      await within(dialog).findByText(catalogEn["problem.invalid_account"]),
    ).toBeVisible();
    expect(screen.getByRole("dialog")).toBe(dialog);
  });
});
