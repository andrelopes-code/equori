import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  cardID,
  cardRoutes,
  checkingID,
  parentID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const createdID = "e0000000-0000-4000-8000-0000000000aa";

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
  it("offers the kinds under four headings", async () => {
    await renderApp("/accounts/new", { fetch: api([]) });
    for (const heading of [
      "kind.group.accounts",
      "kind.group.cards",
      "kind.group.reserves",
      "kind.group.debts",
    ] as const) {
      expect(
        await screen.findByRole("group", { name: catalogEn[heading] }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("radio", {
        name: new RegExp(catalogEn["kind.credit_card"], "i"),
      }),
    ).toBeInTheDocument();
  });

  it("opens on the card's billing cycle when the kind is given", async () => {
    await renderApp("/accounts/new?kind=credit_card", { fetch: api([]) });
    expect(
      await screen.findByRole("group", {
        name: catalogEn["accountForm.billing"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: catalogEn["accountForm.yield"] }),
    ).not.toBeInTheDocument();
  });

  it("offers automatic yield for a reserve only", async () => {
    await renderApp("/accounts/new?kind=reserve", { fetch: api([]) });
    expect(
      await screen.findByRole("switch", {
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

  it("moves the account under a parent and states a refusal under the field", async () => {
    const sent: Sent[] = [];
    await renderApp(`/accounts/${checkingID}/edit`, { fetch: api(sent) });
    const parent = await screen.findByRole("combobox", {
      name: catalogEn["accountForm.parent"],
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

  // Owner review item 15: the parent field names each candidate's kind and what it holds, and
  // says where the account will stand.
  it("offers each parent with its kind and what it holds, and says where the account stands", async () => {
    await renderApp(`/accounts/${checkingID}/edit`, { fetch: api([]) });
    const parent = await screen.findByRole("combobox", {
      name: catalogEn["accountForm.parent"],
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
