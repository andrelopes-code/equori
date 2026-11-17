import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  cardID,
  brokerageID,
  cardRoutes,
  checkingID,
  itauID,
  parentID,
  stockID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { optionalName } from "@/testing/optional-name";
import { renderApp } from "@/testing/render-app";

const createdID = "e0000000-0000-4000-8000-0000000000aa";
const newInstitutionID = "e0000000-0000-4000-8000-0000000000bb";

interface Sent {
  route: string;
  body: unknown;
}

function api(
  sent: Sent[],
  overrides: Record<
    string,
    (req: Request) => Response | Promise<Response>
  > = {},
) {
  const record =
    (route: string, answer: (body: unknown) => Response) =>
    async (req: Request) => {
      const body: unknown = await req.json();
      sent.push({ route, body });
      return answer(body);
    };
  return fakeApi(
    accountRoutes({
      "POST /api/v1/accounts": record("POST /accounts", (body) =>
        json(201, {
          ...(body as object),
          id: createdID,
          yield_mode: "none",
          opened_on: "2026-10-17",
        }),
      ),
      "POST /api/v1/institutions": record("POST /institutions", (body) =>
        json(201, { ...(body as object), id: newInstitutionID }),
      ),
      [`GET /api/v1/accounts/${createdID}`]: () =>
        json(200, {
          id: createdID,
          name: "Itaú Visa",
          class: "liability",
          kind: "credit_card",
          currency: "BRL",
          opened_on: "2026-10-17",
          yield_mode: "none",
        }),
      [`POST /api/v1/accounts/${createdID}/billing-cycle-rules`]: record(
        "rule",
        () => problem(503, "server_busy"),
      ),
      [`PATCH /api/v1/accounts/${checkingID}`]: record("PATCH", (body) =>
        json(200, { ...accountFixtures[0], ...(body as object) }),
      ),
      [`PUT /api/v1/accounts/${checkingID}/parent`]: record("PUT parent", () =>
        problem(422, "validation_failed", {
          errors: [
            { field: "parent_id", message: "The parent would make a cycle." },
          ],
        }),
      ),
      ...overrides,
    }),
  );
}

function field(label: string) {
  return screen.getByRole("textbox", { name: label });
}

beforeEach(() => {
  sessionStorage.clear();
});

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replaceAll(`{${k}}`, v),
    catalogEn[key],
  );
}

describe("New account", () => {
  // KC1: the gallery holds the kinds in two groups, by side of the net worth.
  it("offers the kinds under the two groups of the gallery", async () => {
    await renderApp("/accounts/new", { fetch: api([]) });
    await screen.findByRole("group", { name: catalogEn["kindChooser.assets"] });
    const owe = screen.getByRole("group", {
      name: catalogEn["kindChooser.liabilities"],
    });
    expect(
      within(owe).getByRole("radio", {
        name: new RegExp(catalogEn["kind.title.credit_card"], "i"),
      }),
    ).toBeInTheDocument();
  });

  // BC1 as amended by KC7: the panel carries the hint of the brokerage.
  it("shows the hint of the brokerage in the panel once it is chosen", async () => {
    await renderApp("/accounts/new", { fetch: api([]) });
    await userEvent.click(
      await screen.findByRole("radio", {
        name: new RegExp(catalogEn["kind.title.brokerage"], "i"),
      }),
    );
    const panel = await screen.findByRole("complementary");

    // KC7: one line per sentence of the hint.
    for (const sentence of catalogEn["kind.hint.brokerage"].split(/(?<=\.) /)) {
      expect(within(panel).getByText(sentence)).toBeInTheDocument();
    }
  });

  // KC3: a choice keeps the gallery on screen; Continue opens the form.
  it("keeps the gallery after a choice and opens the form on Continue", async () => {
    await renderApp("/accounts/new", { fetch: api([]) });
    const reserve = await screen.findByRole("radio", {
      name: new RegExp(catalogEn["kind.title.reserve"], "i"),
    });
    const next = screen.getByRole("button", {
      name: catalogEn["accountForm.continue"],
    });
    expect(next).toBeDisabled();
    await userEvent.click(reserve);
    expect(reserve).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(11);
    expect(
      screen.getByText(catalogEn["kindPanel.accounts"]),
    ).toBeInTheDocument();
    await userEvent.click(next);
    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
    ).toBeInTheDocument();
  });

  // KC6: the open accounts of the kind, the children of a brokerage left out.
  it("counts the accounts of a kind on its tile", async () => {
    await renderApp("/accounts/new", { fetch: api([]) });
    const tile = await screen.findByRole("radio", {
      name: new RegExp(catalogEn["kind.title.brokerage"], "i"),
    });
    expect(tile).toHaveTextContent(catalogEn["kindPanel.countOne"]);
  });

  // BC2: a brokerage is a line of its own, so the create form asks for no parent.
  it("asks for a parent account for a checking account and not for a brokerage", async () => {
    const checking = await renderApp("/accounts/new?kind=checking", {
      fetch: api([]),
    });
    expect(
      await screen.findByRole("combobox", {
        name: optionalName(catalogEn["accountForm.parent"]),
      }),
    ).toBeInTheDocument();
    checking.unmount();

    await renderApp("/accounts/new?kind=brokerage", { fetch: api([]) });
    await screen.findByRole("textbox", {
      name: catalogEn["accountForm.name"],
    });
    expect(
      screen.queryByRole("combobox", {
        name: optionalName(catalogEn["accountForm.parent"]),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["accountForm.cashOpening"]),
    ).toBeInTheDocument();
  });

  // BC16: the form asks where the money is once an institution is chosen, for a brokerage only.
  it("asks where the money of a brokerage is after the institution is chosen", async () => {
    await renderApp("/accounts/new?kind=brokerage", { fetch: api([]) });
    await screen.findByRole("textbox", { name: catalogEn["accountForm.name"] });
    const label = catalogEn["accountForm.cashMode.label"];
    expect(screen.queryByRole("group", { name: label })).toBeNull();

    const institution = screen.getByRole("combobox", {
      name: new RegExp(catalogEn["accountForm.institution"]),
    });
    await userEvent.click(institution);
    await userEvent.type(institution, "Nubank");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Nubank/ }),
    );

    const group = await screen.findByRole("group", { name: label });
    expect(
      within(group).getByRole("radio", {
        name: words("accountForm.cashMode.institution", {
          institution: "Nubank",
        }),
      }),
    ).toBeChecked();
    expect(
      screen.queryByText(catalogEn["accountForm.cashOpening"]),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(group).getByRole("radio", {
        name: catalogEn["accountForm.cashMode.own"],
      }),
    );
    expect(
      await screen.findByText(catalogEn["accountForm.cashOpening"]),
    ).toBeInTheDocument();
  });

  it("states that the money stays in the brokerage when the institution has no account to pay from", async () => {
    await renderApp("/accounts/new?kind=brokerage", { fetch: api([]) });
    await screen.findByRole("textbox", { name: catalogEn["accountForm.name"] });
    const institution = screen.getByRole("combobox", {
      name: new RegExp(catalogEn["accountForm.institution"]),
    });
    await userEvent.click(institution);
    await userEvent.type(institution, "Itaú");
    await userEvent.click(
      // The institution of the book, not the catalogue entries that share the prefix.
      (await screen.findAllByRole("option", { name: /^Itaú/ })).find((o) =>
        o.textContent.endsWith("Itaú341"),
      ) ?? institution,
    );

    expect(
      await screen.findByText(
        words("accountForm.cashMode.ownOnly", { institution: "Itaú" }),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /^In my account/ })).toBeNull();
    expect(
      screen.getByText(catalogEn["accountForm.cashOpening"]),
    ).toBeInTheDocument();
  });

  it("does not ask where the money is for another kind", async () => {
    await renderApp("/accounts/new?kind=checking", { fetch: api([]) });
    await screen.findByRole("textbox", { name: catalogEn["accountForm.name"] });
    const institution = screen.getByRole("combobox", {
      name: new RegExp(catalogEn["accountForm.institution"]),
    });
    await userEvent.click(institution);
    await userEvent.type(institution, "Nubank");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Nubank/ }),
    );

    expect(
      screen.queryByRole("group", {
        name: catalogEn["accountForm.cashMode.label"],
      }),
    ).toBeNull();
  });

  it("opens on the card's billing cycle when the kind is given", async () => {
    await renderApp("/accounts/new?kind=credit_card", { fetch: api([]) });
    expect(
      await screen.findByRole("group", {
        name: catalogEn["accountForm.billing"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: catalogEn["accountForm.yield"] }),
    ).not.toBeInTheDocument();
  });

  it("shows the chosen kind with its hint and returns to the kinds on change", async () => {
    await renderApp("/accounts/new?kind=reserve", { fetch: api([]) });
    const kind = await screen.findByRole("group", {
      name: catalogEn["accountForm.kind"],
    });
    expect(kind).toHaveTextContent(catalogEn["kind.title.reserve"]);
    expect(kind).toHaveTextContent(catalogEn["kind.hint.reserve"]);
    await userEvent.click(
      within(kind).getByRole("button", {
        name: catalogEn["accountForm.changeKind"],
      }),
    );
    expect(
      await screen.findByRole("radio", {
        name: new RegExp(catalogEn["kind.title.reserve"], "i"),
      }),
    ).toBeChecked();
  });

  it("offers automatic yield for a reserve only", async () => {
    await renderApp("/accounts/new?kind=reserve", { fetch: api([]) });
    expect(
      await screen.findByRole("checkbox", {
        name: catalogEn["accountForm.yield"],
      }),
    ).toBeInTheDocument();
  });

  it("creates the account and opens it", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp("/accounts/new?kind=checking", {
      fetch: api(sent),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
      "Conta conjunta",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["accountForm.create"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/accounts/${createdID}`);
    });
    expect(sent).toEqual([
      {
        route: "POST /accounts",
        body: {
          name: "Conta conjunta",
          class: "asset",
          kind: "checking",
          currency: "BRL",
          opened_on: "2026-10-17",
          yield_mode: "none",
        },
      },
    ]);
  });

  it("creates a catalogue institution only when the account is created", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp("/accounts/new?kind=checking", {
      fetch: api(sent),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
      "Conta BB",
    );
    const institution = screen.getByRole("combobox", {
      name: new RegExp(catalogEn["accountForm.institution"]),
    });
    await userEvent.click(institution);
    await userEvent.type(institution, "Banco do Bra");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Banco do Brasil/ }),
    );
    expect(sent).toEqual([]);

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["accountForm.create"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/accounts/${createdID}`);
    });
    expect(sent.map((s) => s.route)).toEqual([
      "POST /institutions",
      "POST /accounts",
    ]);
    expect(sent[0]?.body).toEqual({
      name: "Banco do Brasil",
      code: "001",
      identifier: { scheme: "br_ispb", identifier: "00000000" },
    });
    expect(sent[1]?.body).toMatchObject({ institution_id: newInstitutionID });
  });

  it("states the server's field errors under their fields and in the summary", async () => {
    await renderApp("/accounts/new?kind=checking", {
      fetch: api([], {
        "POST /api/v1/accounts": () =>
          problem(422, "validation_failed", {
            errors: [{ field: "name", message: "The name is taken." }],
          }),
      }),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
      "Nubank",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["accountForm.create"] }),
    );
    expect(await screen.findByText("The name is taken.")).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["problem.validation_failed"]),
    ).toBeInTheDocument();
    expect(field(catalogEn["accountForm.name"])).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  // About 10 s alone; beside the Go tests of the commit gate it passes the 15 s default.
  it("opens the card and names the setup step that failed", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp("/accounts/new?kind=credit_card", {
      fetch: api(sent),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
      "Itaú Visa",
    );
    const billing = screen.getByRole("group", {
      name: catalogEn["accountForm.billing"],
    });
    await userEvent.click(
      within(billing).getByRole("combobox", {
        name: catalogEn["accountForm.closingDay"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "25" }));
    await userEvent.click(
      within(billing).getByRole("combobox", {
        name: catalogEn["accountForm.dueDay"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "5" }));
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["accountForm.create"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/cards/${createdID}`);
    });
    expect(
      await screen.findByText(
        catalogEn["accountSetup.failed"].replace(
          "{step}",
          catalogEn["accountSetup.step.rule"],
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: catalogEn["accountSetup.retry"] }),
    ).toBeInTheDocument();
    expect(sent.map((s) => s.route)).toEqual(["POST /accounts", "rule"]);
  }, 30_000);

  it("offers the card's appearance when creating a credit card", async () => {
    await renderApp("/accounts/new?kind=credit_card", { fetch: api([]) });
    const customize = await screen.findByRole("switch", {
      name: catalogEn["accountForm.cardAppearance.customize"],
    });
    expect(
      screen.queryByRole("radio", { name: catalogEn["cardFace.color.yellow"] }),
    ).not.toBeInTheDocument();
    await userEvent.click(customize);
    expect(
      await screen.findByRole("radio", {
        name: catalogEn["cardFace.color.yellow"],
      }),
    ).toBeInTheDocument();
  });

  it("does not offer the card's appearance for a checking account", async () => {
    await renderApp("/accounts/new?kind=checking", { fetch: api([]) });
    await screen.findByRole("textbox", { name: catalogEn["accountForm.name"] });
    expect(
      screen.queryByRole("switch", {
        name: catalogEn["accountForm.cardAppearance.customize"],
      }),
    ).not.toBeInTheDocument();
  });

  it("sends the chosen appearance after the account is created", async () => {
    const sent: Sent[] = [];
    await renderApp("/accounts/new?kind=credit_card", {
      fetch: api(sent, {
        [`POST /api/v1/accounts/${createdID}/billing-cycle-rules`]: async (
          req,
        ) => {
          sent.push({ route: "rule", body: await req.json() });
          return json(201, {});
        },
        [`PUT /api/v1/accounts/${createdID}/card-face`]: async (req) => {
          sent.push({ route: "PUT card-face", body: await req.json() });
          return json(200, {});
        },
      }),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
      "Itaú Visa",
    );
    const billing = screen.getByRole("group", {
      name: catalogEn["accountForm.billing"],
    });
    await userEvent.click(
      within(billing).getByRole("combobox", {
        name: catalogEn["accountForm.closingDay"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "25" }));
    await userEvent.click(
      within(billing).getByRole("combobox", {
        name: catalogEn["accountForm.dueDay"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "5" }));
    await userEvent.click(
      screen.getByRole("switch", {
        name: catalogEn["accountForm.cardAppearance.customize"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("radio", {
        name: catalogEn["cardFace.color.yellow"],
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["accountForm.create"] }),
    );
    await waitFor(() => {
      expect(sent.map((s) => s.route)).toEqual([
        "POST /accounts",
        "rule",
        "PUT card-face",
      ]);
    });
    expect(sent[2]?.body).toEqual({
      color: "#fce300",
      art: null,
      chip: null,
      orientation: null,
      brand: null,
    });
  }, 30_000);

  it("keeps what was typed after leaving the form", async () => {
    const { router } = await renderApp("/accounts/new?kind=checking", {
      fetch: api([]),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
      "Conta salário",
    );
    await router.navigate({ to: "/accounts/institutions" });
    await router.navigate({ to: "/accounts/new" });
    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["accountForm.name"],
      }),
    ).toHaveValue("Conta salário");
  });
});

describe("Edit account", () => {
  it("creates a chosen catalogue institution when the account is saved", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp(`/accounts/${checkingID}/edit`, {
      fetch: api(sent),
    });
    const name = await screen.findByRole("textbox", {
      name: catalogEn["accountForm.name"],
    });
    await waitFor(() => {
      expect(name).toHaveValue("Nubank");
    });
    const institution = screen.getByRole("combobox", {
      name: new RegExp(catalogEn["accountForm.institution"]),
    });
    await userEvent.click(institution);
    await userEvent.clear(institution);
    await userEvent.type(institution, "Banco do Bra");
    await userEvent.click(
      await screen.findByRole("option", { name: /^Banco do Brasil/ }),
    );
    expect(sent).toEqual([]);

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/accounts/${checkingID}`);
    });
    expect(sent.map((s) => s.route)).toEqual(["POST /institutions", "PATCH"]);
    expect(sent[1]?.body).toEqual({ institution_id: newInstitutionID });
  });

  it("reuses the owned institution that has the name of the chosen catalogue entry", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp(`/accounts/${checkingID}/edit`, {
      fetch: api(sent),
    });
    const name = await screen.findByRole("textbox", {
      name: catalogEn["accountForm.name"],
    });
    await waitFor(() => {
      expect(name).toHaveValue("Nubank");
    });
    const institution = screen.getByRole("combobox", {
      name: new RegExp(catalogEn["accountForm.institution"]),
    });
    await userEvent.click(institution);
    await userEvent.clear(institution);
    await userEvent.type(institution, "Itaú Unibanco");
    await userEvent.click(
      await screen.findByRole("option", { name: /ITAÚ UNIBANCO/ }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/accounts/${checkingID}`);
    });
    expect(sent.map((s) => s.route)).toEqual(["PATCH"]);
    expect(sent[0]?.body).toEqual({ institution_id: itauID });
  });

  it("sends only the field that moved", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp(`/accounts/${checkingID}/edit`, {
      fetch: api(sent),
    });
    const name = await screen.findByRole("textbox", {
      name: catalogEn["accountForm.name"],
    });
    await waitFor(() => {
      expect(name).toHaveValue("Nubank");
    });
    await userEvent.clear(name);
    await userEvent.type(name, "Nubank PF");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/accounts/${checkingID}`);
    });
    expect(sent).toEqual([{ route: "PATCH", body: { name: "Nubank PF" } }]);
  });

  it("leaves the account out of the reserve", async () => {
    const sent: Sent[] = [];
    await renderApp(`/accounts/${checkingID}/edit`, { fetch: api(sent) });
    const exclude = await screen.findByRole("checkbox", {
      name: catalogEn["accountForm.excludeFromLiquidity"],
    });
    expect(exclude).not.toBeChecked();
    await userEvent.click(exclude);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "PATCH", body: { excluded_from_liquidity: true } },
      ]);
    });
  });

  it("moves the account under a parent and states a refusal under the field", async () => {
    const sent: Sent[] = [];
    await renderApp(`/accounts/${checkingID}/edit`, { fetch: api(sent) });
    const parent = await screen.findByRole("combobox", {
      name: optionalName(catalogEn["accountForm.parent"]),
    });
    await userEvent.click(parent);
    await userEvent.click(
      await screen.findByRole("option", { name: /^Carteiras/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.save"] }),
    );
    expect(
      await screen.findByText("The parent would make a cycle."),
    ).toBeInTheDocument();
    expect(sent).toEqual([
      { route: "PUT parent", body: { parent_id: parentID } },
    ]);
  });

  // BC2: the edit form draws the parent field of a brokerage only when it already has one.
  it("draws the parent field of a brokerage only when it has a parent", async () => {
    const top = await renderApp(`/accounts/${brokerageID}/edit`, {
      fetch: api([]),
    });
    await screen.findByRole("textbox", { name: catalogEn["accountForm.name"] });
    expect(
      screen.queryByRole("combobox", {
        name: optionalName(catalogEn["accountForm.parent"]),
      }),
    ).not.toBeInTheDocument();
    top.unmount();

    await renderApp(`/accounts/${stockID}/edit`, { fetch: api([]) });
    expect(
      await screen.findByRole("combobox", {
        name: optionalName(catalogEn["accountForm.parent"]),
      }),
    ).toBeInTheDocument();
  });

  // Owner review item 15: the parent field names each candidate's kind and what it holds, and
  // says where the account will stand.
  it("offers each parent with its kind and what it holds, and says where the account stands", async () => {
    await renderApp(`/accounts/${checkingID}/edit`, { fetch: api([]) });
    const parent = await screen.findByRole("combobox", {
      name: optionalName(catalogEn["accountForm.parent"]),
    });
    expect(
      await screen.findByText(catalogEn["accountForm.parentNone"]),
    ).toBeInTheDocument();
    await userEvent.click(parent);
    const option = await screen.findByRole("option", { name: /^Carteiras/ });
    expect(option).toHaveTextContent(catalogEn["kind.title.wallet"]);
    expect(option).toHaveTextContent(
      words("accountForm.parentHolds", { count: "1" }),
    );
    await userEvent.click(option);
    expect(
      await screen.findByText(
        words("accountForm.parentInside", { name: "Carteiras" }),
      ),
    ).toBeInTheDocument();
  });

  // Owner review item 18: the edit form has no billing section, so the billing rules of a new
  // card's setup must not block it.
  it("saves a card's edit without asking for the billing a new card sets up", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp(`/accounts/${cardID}/edit`, {
      fetch: api(sent, {
        ...cardRoutes(),
        [`PATCH /api/v1/accounts/${cardID}`]: async (req) => {
          const body: unknown = await req.json();
          sent.push({ route: "PATCH card", body });
          return json(200, { ...accountFixtures[2], ...(body as object) });
        },
      }),
    });
    const name = await screen.findByRole("textbox", {
      name: new RegExp(`^${catalogEn["accountForm.name"]}`),
    });
    await userEvent.clear(name);
    await userEvent.type(name, "Itaú Visa Black");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/cards/${cardID}`);
    });
    expect(screen.queryByText(catalogEn["accountForm.fixFields"])).toBeNull();
    expect(sent).toEqual([
      { route: "PATCH card", body: { name: "Itaú Visa Black" } },
    ]);
  });
});
