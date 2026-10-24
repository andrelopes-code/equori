import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { instrumentsApi as api } from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

const csv = new File(
  ["instrument,quote_instrument,date,value\nPETR4,BRL,2026-10-16,38.45\n"],
  "prices.csv",
  { type: "text/csv" },
);

async function openImport() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: catalogEn["prices.import"] }),
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

describe("Price import", () => {
  it("states that the import is all or nothing and sends the file", async () => {
    let body = "";
    const fetch = api({
      "POST /api/v1/prices/import": async (req) => {
        // The multipart body read as text: the test environment's Request cannot parse its own form.
        body = await req.text();
        return json(200, { recorded: 1 });
      },
    });
    await renderApp("/instruments", { fetch });
    const { user, dialog } = await openImport();
    expect(
      within(dialog).getByText(catalogEn["prices.import.allOrNothing"]),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["prices.import.send"],
      }),
    );
    expect(
      await within(dialog).findByText(
        catalogEn["prices.import.recorded"].replace("{count}", "1"),
      ),
    ).toBeInTheDocument();
    expect(body).toContain('name="file"');
    // The test environment writes the file part without its bytes: the part and its type stand for the file.
    expect(body).toContain("Content-Type: text/csv");
  });

  it("shows the problem of the rejected line and that nothing was recorded", async () => {
    const fetch = api({
      "POST /api/v1/prices/import": () =>
        problem(422, "validation_failed", {
          errors: [{ field: "line 3", message: "value must be positive." }],
        }),
    });
    await renderApp("/instruments", { fetch });
    const { user, dialog } = await openImport();
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["prices.import.send"],
      }),
    );
    expect(
      await within(dialog).findByText("line 3: value must be positive."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(catalogEn["prices.import.nothing"]),
    ).toBeInTheDocument();
  });
});
