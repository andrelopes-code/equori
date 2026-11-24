import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn as en } from "@/i18n/catalog.en";
import {
  accountRoutes,
  connectionFixture,
  connectionID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const openName = en["links.renameOf"].replace("{name}", connectionFixture.name);

describe("Rename a connection", () => {
  it("sends the new name and closes", async () => {
    const sent: unknown[] = [];
    await renderApp("/accounts/links", {
      fetch: fakeApi(
        accountRoutes({
          [`PATCH /api/v1/connections/${connectionID}`]: async (req) => {
            sent.push(await req.json());
            return json(200, connectionFixture);
          },
        }),
      ),
    });

    await userEvent.click(
      await screen.findByRole("button", { name: openName }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    const field = dialog.getByRole("textbox", {
      name: en["links.connect.bank"],
    });
    expect(field).toHaveValue(connectionFixture.name);

    await userEvent.clear(field);
    await userEvent.type(field, "  Itaú ");
    await userEvent.click(
      dialog.getByRole("button", { name: en["detail.save"] }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent).toEqual([{ name: "Itaú" }]);
  });

  it("states a refusal and keeps the dialog", async () => {
    await renderApp("/accounts/links", {
      fetch: fakeApi(
        accountRoutes({
          [`PATCH /api/v1/connections/${connectionID}`]: () =>
            problem(422, "validation_failed"),
        }),
      ),
    });

    await userEvent.click(
      await screen.findByRole("button", { name: openName }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(
      dialog.getByRole("textbox", { name: en["links.connect.bank"] }),
      "x",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: en["detail.save"] }),
    );

    expect(await dialog.findByRole("alert")).toBeVisible();
  });
});
