import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const admin = {
  id: 1,
  email: "ann@example.com",
  role: "admin",
  language: "en",
  region: "PT",
};

function setupApi(opts: { required: boolean; complete?: () => Response }) {
  const state = {
    bodies: [] as unknown[],
    signedIn: false,
    required: opts.required,
  };
  const fetch = fakeApi({
    "GET /api/v1/setup": () => json(200, { required: state.required }),
    // As the server: once a first user exists, by this request or another, no setup remains.
    "POST /api/v1/setup": async (req) => {
      state.bodies.push(await req.json());
      const response = opts.complete?.() ?? json(201, admin);
      if (response.status === 201) state.signedIn = true;
      if (response.status === 201 || response.status === 409)
        state.required = false;
      return response;
    },
    "GET /api/v1/me": () =>
      state.signedIn ? json(200, admin) : problem(401, "unauthenticated"),
    "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/institutions": () => json(200, { items: [] }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
  });
  return { fetch, state };
}

function field(label: string) {
  return screen.findByLabelText(label, { exact: false, selector: "input" });
}

async function fill(region: string | null) {
  const actor = userEvent.setup();
  await actor.type(await field(catalogEn["setup.email"]), "ann@example.com");
  await actor.type(
    await field(catalogEn["setup.password"]),
    "correct horse battery",
  );
  if (region !== null) {
    await actor.click(
      await screen.findByRole("combobox", { name: catalogEn["setup.region"] }),
    );
    await actor.click(await screen.findByRole("option", { name: region }));
  }
  await actor.click(
    screen.getByRole("button", { name: catalogEn["setup.submit"] }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("first-user setup", () => {
  it("sends the token of the address and removes it from the address bar", async () => {
    const { fetch, state } = setupApi({ required: true });
    const { router } = await renderApp("/setup#token=abc", { fetch });
    await waitFor(() => {
      expect(router.state.location.hash).toBe("");
    });
    await fill("Portugal");
    await waitFor(() => {
      expect(state.bodies).toEqual([
        {
          token: "abc",
          email: "ann@example.com",
          password: "correct horse battery",
          language: "en",
          region: "PT",
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });

  it("explains where the address is when it carries no token", async () => {
    const { fetch } = setupApi({ required: true });
    await renderApp("/setup", { fetch });
    expect(
      await screen.findByText(catalogEn["setup.token_missing"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: catalogEn["setup.submit"] }),
    ).toBeNull();
  });

  it("starts the language at the browser's first catalog", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["pt-BR", "en"]);
    const { fetch } = setupApi({ required: true });
    await renderApp("/setup#token=abc", { fetch });
    // The interface itself follows the browser's languages before a profile exists.
    expect(
      await screen.findByRole("combobox", {
        name: catalogPtBR["setup.language"],
      }),
    ).toHaveTextContent("Português");
  });

  it("asks for a region before it sends anything", async () => {
    const { fetch, state } = setupApi({ required: true });
    await renderApp("/setup#token=abc", { fetch });
    await fill(null);
    // FM-03: the same words under the control and in the form's summary.
    expect(
      await screen.findAllByText(catalogEn["setup.required"]),
    ).toHaveLength(2);
    expect(state.bodies).toEqual([]);
  });

  it("goes to the login when the first user already exists", async () => {
    const { fetch } = setupApi({
      required: true,
      complete: () => problem(409, "setup_complete"),
    });
    const { router } = await renderApp("/setup#token=abc", { fetch });
    await fill("Portugal");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });

  it("leads the login to the setup while no user exists", async () => {
    const { fetch } = setupApi({ required: true });
    const { router } = await renderApp("/login", { fetch });
    expect(router.state.location.pathname).toBe("/setup");
  });

  it("leads the setup to the login once a user exists", async () => {
    const { fetch } = setupApi({ required: false });
    const { router } = await renderApp("/setup#token=abc", { fetch });
    expect(router.state.location.pathname).toBe("/login");
  });
});
