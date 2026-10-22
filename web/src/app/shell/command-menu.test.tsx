import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, cardID, reserveID } from "@/testing/account-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function palette() {
  const user = userEvent.setup();
  const rendered = await renderApp("/", { fetch: fakeApi(accountRoutes()) });
  await user.keyboard("{Control>}k{/Control}");
  const dialog = await screen.findByRole("dialog");
  return { user, dialog, ...rendered };
}

describe("CommandMenu accounts", () => {
  it.each([
    [catalogEn["palette.newAccount"], "/accounts/new"],
    [catalogEn["palette.institutions"], "/accounts/institutions"],
    [catalogEn["palette.links"], "/accounts/links"],
  ])("runs %s", async (label, path) => {
    const { user, dialog, router } = await palette();
    await user.type(within(dialog).getByRole("combobox"), label);
    await user.click(
      await within(dialog).findByRole("option", { name: label }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(path);
    });
  });

  it("goes to an account by its name", async () => {
    const { user, dialog, router } = await palette();
    await user.type(
      within(dialog).getByRole("combobox"),
      "Reserva de emergência",
    );
    await user.click(
      await within(dialog).findByRole("option", {
        name: /Reserva de emergência/,
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/accounts/${reserveID}`);
    });
  });

  it("goes to a card's page by its name", async () => {
    const { user, dialog, router } = await palette();
    await user.type(within(dialog).getByRole("combobox"), "Itaú Visa");
    await user.click(
      await within(dialog).findByRole("option", { name: /Itaú Visa/ }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/cards/${cardID}`);
    });
  });

  it("leaves closed accounts and categories out", async () => {
    const { user, dialog } = await palette();
    // The accounts are read once the palette lists an open one.
    await user.type(within(dialog).getByRole("combobox"), "Corretora");
    expect(
      await within(dialog).findByRole("option", { name: /Corretora/ }),
    ).toBeInTheDocument();
    await user.clear(within(dialog).getByRole("combobox"));
    await user.type(within(dialog).getByRole("combobox"), "Conta antiga");
    expect(
      within(dialog).queryByRole("option", { name: /Conta antiga/ }),
    ).not.toBeInTheDocument();
    await user.clear(within(dialog).getByRole("combobox"));
    await user.type(within(dialog).getByRole("combobox"), "Mercado");
    expect(
      within(dialog).queryByRole("option", { name: /Mercado/ }),
    ).not.toBeInTheDocument();
  });

  it("asks which account a statement is imported into", async () => {
    const { user, dialog, router } = await palette();
    await user.type(
      within(dialog).getByRole("combobox"),
      catalogEn["palette.importStatement"],
    );
    await user.click(
      await within(dialog).findByRole("option", {
        name: catalogEn["palette.importStatement"],
      }),
    );
    await user.click(
      await within(dialog).findByRole("option", { name: /Itaú Visa/ }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/accounts/${cardID}/import`);
    });
  });
});
