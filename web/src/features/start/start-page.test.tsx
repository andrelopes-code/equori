import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const checkingID = "e0000000-0000-4000-8000-000000000001";
const cardID = "e0000000-0000-4000-8000-000000000002";
const cashID = "e0000000-0000-4000-8000-000000000003";

const createdIDs: Record<string, string> = {
  checking: checkingID,
  credit_card: cardID,
  cash: cashID,
};

interface Sent {
  route: string;
  body: unknown;
}

type Handler = (req: Request) => Response | Promise<Response>;

function api(sent: Sent[], overrides: Record<string, Handler> = {}) {
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
          ...(body as { kind: string }),
          id: createdIDs[(body as { kind: string }).kind],
          yield_mode: "none",
        }),
      ),
      "POST /api/v1/transactions": record("opening", (body) =>
        json(201, {
          ...(body as object),
          id: "f0000000-0000-4000-8000-0000000000aa",
        }),
      ),
      [`POST /api/v1/accounts/${cardID}/billing-cycle-rules`]: record(
        "rule",
        (body) => json(201, body),
      ),
      ...overrides,
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

async function chooseInstitution() {
  await userEvent.click(
    await screen.findByRole("combobox", {
      name: catalogEn["start.where.institution"],
    }),
  );
  await userEvent.click(await screen.findByRole("option", { name: /^Nubank/ }));
}

async function chooseKinds(kinds: readonly string[]) {
  for (const kind of kinds) {
    await userEvent.click(await screen.findByRole("checkbox", { name: kind }));
  }
}

async function toDetails(kinds: readonly string[], cash: boolean) {
  await chooseInstitution();
  await chooseKinds(kinds);
  if (cash) {
    await userEvent.click(
      screen.getByRole("checkbox", { name: catalogEn["start.where.cash"] }),
    );
  }
  await userEvent.click(
    screen.getByRole("button", { name: catalogEn["start.continue"] }),
  );
}

async function pickDay(group: HTMLElement, label: string, day: string) {
  await userEvent.click(within(group).getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: day }));
}

async function fillOpening(group: HTMLElement, amount: string) {
  await userEvent.type(
    within(group).getByRole("textbox", {
      name: new RegExp(catalogEn["accountForm.opening"]),
    }),
    amount,
  );
}

describe("First-use walkthrough", () => {
  // S243
  it("keeps Continue disabled until an institution or cash is chosen", async () => {
    await renderApp("/start", { fetch: api([]) });
    const next = await screen.findByRole("button", {
      name: catalogEn["start.continue"],
    });
    expect(next).toBeDisabled();

    await userEvent.click(
      screen.getByRole("checkbox", { name: catalogEn["start.where.cash"] }),
    );

    expect(next).toBeEnabled();
  });

  // S244
  it("creates the accounts of the choices and offers how entries arrive", async () => {
    const sent: Sent[] = [];
    await renderApp("/start", { fetch: api(sent) });
    await toDetails(
      [catalogEn["kind.title.checking"], catalogEn["kind.title.credit_card"]],
      true,
    );

    const checking = await screen.findByRole("group", {
      name: "Nubank checking",
    });
    await fillOpening(checking, "1000.00");
    const card = screen.getByRole("group", { name: "Nubank credit card" });
    await pickDay(card, catalogEn["accountForm.closingDay"], "3");
    await pickDay(card, catalogEn["accountForm.dueDay"], "10");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["start.details.create"] }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["start.continue"] }),
    );

    expect(await screen.findByText("Nubank checking")).toBeInTheDocument();
    expect(screen.getByText("Nubank credit card")).toBeInTheDocument();
    expect(screen.getByText(catalogEn["start.cashName"])).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["start.arrive.import"] }),
    ).toHaveAttribute("href", `/accounts/${checkingID}/import`);
    expect(
      screen.getByRole("link", { name: catalogEn["start.arrive.record"] }),
    ).toHaveAttribute("href", "/transactions/new");
    expect(
      screen.getByRole("link", { name: catalogEn["start.arrive.help"] }),
    ).toHaveAttribute("href", "/help/connect-bank");
    expect(
      sent
        .filter((s) => s.route === "POST /accounts")
        .map((s) => (s.body as { kind: string }).kind),
    ).toEqual(["checking", "credit_card", "cash"]);
    const opening = sent.filter((s) => s.route === "opening");
    expect(opening).toHaveLength(1);
    expect(
      (
        opening[0]?.body as {
          postings: { account_id: string; amount: object }[];
        }
      ).postings[0],
    ).toEqual({
      account_id: checkingID,
      amount: { amount: 100000, currency: "BRL" },
    });
    const rules = sent.filter((s) => s.route === "rule");
    expect(rules).toHaveLength(1);
    expect(rules[0]?.body).toMatchObject({ closing_day: 3, due_day: 10 });
  }, 30_000);

  // S245
  it("marks a created account and retries only the rest", async () => {
    const sent: Sent[] = [];
    let posts = 0;
    await renderApp("/start", {
      fetch: api(sent, {
        "POST /api/v1/accounts": async (req) => {
          const body = (await req.json()) as { kind: string };
          sent.push({ route: "POST /accounts", body });
          posts += 1;
          if (posts === 2) {
            return problem(422, "validation_failed", {
              errors: [{ field: "name", message: "The name is taken." }],
            });
          }
          return json(201, {
            ...body,
            id: createdIDs[body.kind],
            yield_mode: "none",
          });
        },
      }),
    });
    await toDetails(
      [catalogEn["kind.title.checking"], catalogEn["kind.title.credit_card"]],
      false,
    );
    const checking = await screen.findByRole("group", {
      name: "Nubank checking",
    });
    const card = screen.getByRole("group", { name: "Nubank credit card" });
    await pickDay(card, catalogEn["accountForm.closingDay"], "3");
    await pickDay(card, catalogEn["accountForm.dueDay"], "10");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["start.details.create"] }),
    );

    expect(await screen.findByText("The name is taken.")).toBeInTheDocument();
    expect(
      within(checking).getByText(catalogEn["start.details.created"]),
    ).toBeInTheDocument();
    expect(
      within(card).queryByText(catalogEn["start.details.created"]),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["start.details.create"] }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: catalogEn["start.continue"] }),
      ).toBeInTheDocument();
    });
    expect(
      sent
        .filter((s) => s.route === "POST /accounts")
        .map((s) => (s.body as { kind: string }).kind),
    ).toEqual(["checking", "credit_card", "credit_card"]);
  }, 30_000);

  // Edge case: a failed later step of a created account
  it("reads an account as created when a step after it fails", async () => {
    const sent: Sent[] = [];
    await renderApp("/start", {
      fetch: api(sent, {
        "POST /api/v1/transactions": () => problem(500, "internal_error"),
      }),
    });
    await toDetails([catalogEn["kind.title.checking"]], false);
    const checking = await screen.findByRole("group", {
      name: "Nubank checking",
    });
    await fillOpening(checking, "50.00");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["start.details.create"] }),
    );

    expect(
      await within(checking).findByText(catalogEn["start.details.created"]),
    ).toBeInTheDocument();
    expect(
      sessionStorage.getItem(`equori.pendingSetup.${checkingID}`),
    ).not.toBe(null);
  }, 30_000);

  // S246 (route part)
  it("leaves for the overview on Not now", async () => {
    const { router } = await renderApp("/start", { fetch: api([]) });

    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["start.notNow"] }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });

  // S257 (A182): a row needs its institution, so its label has no "(optional)".
  it("labels the institution of a row without optional", async () => {
    await renderApp("/start", { fetch: api([]) });
    const label = await screen.findByText(catalogEn["start.where.institution"]);
    expect(label.closest("label")?.textContent).toBe(
      catalogEn["start.where.institution"],
    );
  });
});
