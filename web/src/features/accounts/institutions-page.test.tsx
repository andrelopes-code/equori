import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, itauID, nubankID } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Sent {
  route: string;
  body: unknown;
}

function api(sent: Sent[]) {
  const record = (route: string) => async (req: Request) => {
    const body: unknown = await req.json();
    sent.push({ route, body });
    return json(200, { id: itauID, name: "Itaú", ...(body as object) });
  };
  return fakeApi(
    accountRoutes({
      [`PUT /api/v1/institutions/${itauID}/identifier`]: record("PUT itau"),
      [`PUT /api/v1/institutions/${nubankID}/identifier`]: record("PUT nubank"),
      "POST /api/v1/institutions": record("POST"),
    }),
  );
}

async function rowMenu(name: string) {
  await userEvent.click(
    await screen.findByRole("button", {
      name: catalogEn["institutions.actions"].replace("{name}", name),
    }),
  );
}

describe("InstitutionsPage", () => {
  it("lists each institution with its codes and the number of its accounts", async () => {
    await renderApp("/accounts/institutions", { fetch: api([]) });
    const table = await screen.findByRole("table", {
      name: catalogEn["institutions.title"],
    });
    const nubank = within(table).getByRole("row", { name: /Nubank/ });
    expect(within(nubank).getByText("18236120")).toBeInTheDocument();
    expect(within(nubank).getByText("260")).toBeInTheDocument();
    // The checking account and the reserve.
    expect(within(nubank).getByText("2")).toBeInTheDocument();
    const itau = within(table).getByRole("row", { name: /Itaú/ });
    expect(
      within(itau).getByText(catalogEn["institutions.noLogo"]),
    ).toBeInTheDocument();
  });

  it("sets the logo of an institution from the catalogue", async () => {
    const sent: Sent[] = [];
    await renderApp("/accounts/institutions", { fetch: api(sent) });
    await rowMenu("Itaú");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["institutions.setLogo"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("combobox");
    await userEvent.type(input, "Itaú Uni");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Itaú Unibanco/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "PUT itau",
          body: { scheme: "br_ispb", identifier: "60701190" },
        },
      ]);
    });
  });

  it("removes the logo of an institution", async () => {
    const sent: Sent[] = [];
    await renderApp("/accounts/institutions", { fetch: api(sent) });
    await rowMenu("Nubank");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["institutions.removeLogo"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "PUT nubank", body: { scheme: null, identifier: null } },
      ]);
    });
  });

  it("sets an identifier by scheme after checking its pattern", async () => {
    const sent: Sent[] = [];
    await renderApp("/accounts/institutions", { fetch: api(sent) });
    await rowMenu("Itaú");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["institutions.editIdentifier"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["institutions.scheme"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "bic" }));
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["institutions.identifier"],
      }),
      "bad",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    expect(
      await within(dialog).findByText(
        catalogEn["institutions.identifierPattern"],
      ),
    ).toBeVisible();
    expect(sent).toEqual([]);
    await userEvent.clear(
      within(dialog).getByRole("textbox", {
        name: catalogEn["institutions.identifier"],
      }),
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["institutions.identifier"],
      }),
      "ITAUBRSP",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "PUT itau", body: { scheme: "bic", identifier: "ITAUBRSP" } },
      ]);
    });
  });

  it("previews the logo an identifier resolves to and clears the identifier", async () => {
    const sent: Sent[] = [];
    await renderApp("/accounts/institutions", { fetch: api(sent) });
    await rowMenu("Itaú");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["institutions.editIdentifier"],
      }),
    );
    let dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("img")).toBeNull();
    expect(
      within(dialog).queryByRole("button", {
        name: catalogEn["institutions.clearIdentifier"],
      }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await rowMenu("Nubank");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["institutions.editIdentifier"],
      }),
    );
    dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("textbox", {
        name: catalogEn["institutions.identifier"],
      }),
    ).toHaveValue("18236120");
    expect(dialog.querySelector("img")).not.toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["institutions.clearIdentifier"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "PUT nubank", body: { scheme: null, identifier: null } },
      ]);
    });
  });

  it("offers the schemes the API lists to a user in another region", async () => {
    const sent: Sent[] = [];
    await renderApp("/accounts/institutions", {
      fetch: fakeApi(
        accountRoutes({
          "GET /api/v1/me": () =>
            json(200, {
              id: 1,
              email: "a@b.c",
              role: "admin",
              language: "en",
              region: "DE",
            }),
          "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
          "GET /api/v1/institution-identifier-schemes": () =>
            json(200, { items: [{ id: "bic", pattern: "^[A-Z]{8}$" }] }),
          [`PUT /api/v1/institutions/${itauID}/identifier`]: async (req) => {
            sent.push({ route: "PUT", body: await req.json() });
            return json(200, { id: itauID, name: "Itaú" });
          },
        }),
      ),
    });
    await rowMenu("Itaú");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["institutions.editIdentifier"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["institutions.scheme"],
      }),
    );
    expect(await screen.findAllByRole("option")).toHaveLength(1);
    await userEvent.click(screen.getByRole("option", { name: "bic" }));
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["institutions.identifier"],
      }),
      "ITAUBRSP",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "PUT", body: { scheme: "bic", identifier: "ITAUBRSP" } },
      ]);
    });
  });

  it("creates an institution from the header", async () => {
    const sent: Sent[] = [];
    await renderApp("/accounts/institutions", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["institutions.new"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("combobox");
    await userEvent.type(input, "Banco do Bra");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Banco do Brasil/ }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "POST",
          body: {
            name: "Banco do Brasil",
            code: "001",
            identifier: { scheme: "br_ispb", identifier: "00000000" },
          },
        },
      ]);
    });
  });
});
