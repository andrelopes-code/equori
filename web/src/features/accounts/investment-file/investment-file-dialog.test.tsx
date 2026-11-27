import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  brokerageID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const csv = new File(["kind,date\n"], "operations.csv", { type: "text/csv" });
const path = `POST /api/v1/brokerages/${brokerageID}/investment-file`;

function page(routes: Parameters<typeof accountRoutes>[0]) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/accounts": () => json(200, { items: accountFixtures }),
      ...routes,
    }),
  );
}

async function openDialog(fetch: ReturnType<typeof page>) {
  const user = userEvent.setup();
  await renderApp(`/accounts/${brokerageID}`, { fetch });
  await user.click(
    await screen.findByRole("button", { name: catalogEn["account.more"] }),
  );
  await user.click(
    await screen.findByRole("menuitem", {
      name: catalogEn["investmentFile.action"],
    }),
  );
  const dialog = await screen.findByRole("dialog");
  const input = await waitFor(() => {
    const found = dialog.querySelector<HTMLInputElement>(
      '[data-ui="upload"] input[type="file"]',
    );
    if (found === null) throw new Error("no file input yet");
    return found;
  });
  await user.upload(input, csv);
  return { user, dialog };
}

describe("Investment file dialog", () => {
  it("IF1: counts the lines of a dry run, then imports without dry_run", async () => {
    const bodies: string[] = [];
    const fetch = page({
      [path]: async (req) => {
        const body = await req.text();
        bodies.push(body);
        return json(200, { lines: 4, created: 4, skipped: 0 });
      },
    });
    const { user, dialog } = await openDialog(fetch);

    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["investmentFile.check"],
      }),
    );
    expect(
      await within(dialog).findByText(
        "4 lines: 4 to record, 0 already recorded",
      ),
    ).toBeInTheDocument();
    expect(bodies[0]).toContain('name="dry_run"');

    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["investmentFile.import"],
      }),
    );
    expect(
      await within(dialog).findByText("4 recorded, 0 already recorded"),
    ).toBeInTheDocument();
    expect(bodies[1]).not.toContain('name="dry_run"');
  });

  it("IF3: shows the message of a 422 under the file", async () => {
    const fetch = page({
      [path]: () =>
        problem(422, "validation_failed", {
          errors: [{ field: "line 3", message: "date must be YYYY-MM-DD" }],
        }),
    });
    const { user, dialog } = await openDialog(fetch);

    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["investmentFile.check"],
      }),
    );

    expect(
      await within(dialog).findByText("line 3: date must be YYYY-MM-DD"),
    ).toBeInTheDocument();
  });
});
