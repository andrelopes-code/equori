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
      [`PUT /api/v1/institutions/${itauID}/ispb`]: record("PUT itau"),
      [`PUT /api/v1/institutions/${nubankID}/ispb`]: record("PUT nubank"),
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
      expect(sent).toEqual([{ route: "PUT itau", body: { ispb: "60701190" } }]);
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
      expect(sent).toEqual([{ route: "PUT nubank", body: { ispb: null } }]);
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
          body: { name: "Banco do Brasil", code: "001", ispb: "00000000" },
        },
      ]);
    });
  });
});
