import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { meQuery } from "@/features/session";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const user = { id: 1, email: "a@b.c", role: "admin" };

beforeEach(() => {
  localStorage.clear();
});

function sessionApi(opts: {
  loggedIn: boolean;
  login?: () => Response;
  logout?: () => Response;
}) {
  const state = { loggedIn: opts.loggedIn, bodies: [] as string[], logouts: 0 };
  const fetch = fakeApi({
    "GET /api/v1/me": () =>
      state.loggedIn ? json(200, user) : problem(401, "unauthenticated"),
    "POST /api/v1/session": async (req) => {
      state.bodies.push(await req.text());
      const response = opts.login?.() ?? new Response(null, { status: 204 });
      if (response.status === 204) state.loggedIn = true;
      return response;
    },
    "DELETE /api/v1/session": () => {
      state.logouts += 1;
      return opts.logout?.() ?? new Response(null, { status: 204 });
    },
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/institutions": () => json(200, { items: [] }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
  });
  return { fetch, state };
}

// The required mark is part of the label text, so the label matches by substring.
function getField(label: string) {
  return screen.getByLabelText(label, { exact: false });
}

function findField(label: string) {
  return screen.findByLabelText(label, { exact: false });
}

async function signIn(email: string, password: string) {
  const actor = userEvent.setup();
  await actor.type(await findField(catalogEn["login.email"]), email);
  await actor.type(getField(catalogEn["login.password"]), password);
  await actor.click(
    screen.getByRole("button", { name: catalogEn["login.submit"] }),
  );
}

describe("session guard", () => {
  it("redirects an unauthenticated visit to /login with the path", async () => {
    const { fetch } = sessionApi({ loggedIn: false });
    const { router } = await renderApp("/transactions", { fetch });
    expect(router.state.location.href).toBe("/login?redirect=%2Ftransactions");
  });
});

describe("login", () => {
  it("signs in and returns to the requested path", async () => {
    const { fetch, state } = sessionApi({ loggedIn: false });
    const { router } = await renderApp("/transactions", { fetch });
    await signIn("a@b.c", "pw");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions");
    });
    expect(state.bodies).toEqual(['{"email":"a@b.c","password":"pw"}']);
  });

  it.each([
    {
      name: "scheme-relative URL",
      redirect: "%2F%2Fevil.example",
      landing: "/",
    },
    { name: "backslash", redirect: "%2F%5Cevil.example", landing: "/" },
    {
      name: "tab between slashes",
      redirect: "%2F%09%2Fevil.example",
      landing: "/",
    },
    {
      name: "local path",
      redirect: "%2Ftransactions",
      landing: "/transactions",
    },
  ])(
    "lands on $landing after signing in with a $name redirect",
    async ({ redirect, landing }) => {
      const { fetch } = sessionApi({ loggedIn: false });
      const { router } = await renderApp(`/login?redirect=${redirect}`, {
        fetch,
      });
      await signIn("a@b.c", "pw");
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(landing);
      });
    },
  );

  it("shows invalid credentials in an alert and keeps focus on the password", async () => {
    const { fetch } = sessionApi({
      loggedIn: false,
      login: () => problem(401, "invalid_credentials"),
    });
    const { router } = await renderApp("/login", { fetch });
    await signIn("a@b.c", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      catalogEn["problem.invalid_credentials"],
    );
    await waitFor(() => {
      expect(getField(catalogEn["login.password"])).toHaveFocus();
    });
    expect(router.state.location.pathname).toBe("/login");
  });
});

describe("expired session", () => {
  it("clears the cache and redirects after a 401 following login", async () => {
    const { fetch, state } = sessionApi({ loggedIn: true });
    const { router } = await renderApp("/settings", { fetch });
    expect(router.state.location.pathname).toBe("/settings");
    const { queryClient, api } = router.options.context;
    const meKey = meQuery(api).queryKey;
    expect(
      queryClient.getQueryCache().findAll({ queryKey: meKey }),
    ).toHaveLength(1);
    state.loggedIn = false;
    await queryClient.query(meQuery(api)).catch(() => undefined);
    await waitFor(() => {
      expect(router.state.location.href).toBe("/login?redirect=%2Fsettings");
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("logout", () => {
  async function openLogout(fetch: ReturnType<typeof sessionApi>["fetch"]) {
    const actor = userEvent.setup();
    const { router } = await renderApp("/", { width: 360, fetch });
    await actor.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await actor.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.logout"] }),
    );
    return router;
  }

  it("reports a failed logout and keeps the session", async () => {
    const { fetch, state } = sessionApi({
      loggedIn: true,
      logout: () => problem(500, "internal"),
    });
    const router = await openLogout(fetch);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      catalogEn["more.logoutFailed"],
    );
    expect(state.logouts).toBe(1);
    expect(router.state.location.pathname).toBe("/");
  });

  it("ends the session from the more sheet and lands on /login", async () => {
    const actor = userEvent.setup();
    const { fetch, state } = sessionApi({ loggedIn: true });
    const { router } = await renderApp("/", { width: 360, fetch });
    await actor.click(
      screen.getByRole("button", { name: catalogEn["nav.more"] }),
    );
    await actor.click(
      await screen.findByRole("menuitem", { name: catalogEn["more.logout"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(state.logouts).toBe(1);
    expect(
      router.options.context.queryClient.getQueryCache().getAll(),
    ).toHaveLength(0);
  });
});

describe("login layout", () => {
  it("renders without navigation chrome at 360 px", async () => {
    const { fetch } = sessionApi({ loggedIn: false });
    const { container } = await renderApp("/login", { width: 360, fetch });
    await findField(catalogEn["login.email"]);
    expect(container.querySelector('[data-own="navigation-bar"]')).toBeNull();
    expect(container.querySelector('[data-ui="side-navigation"]')).toBeNull();
    // No top bar; the page carries the wordmark.
    expect(container.querySelector('[data-ui="top-navigation"]')).toBeNull();
    expect(screen.getByText(catalogEn["app.name"])).toBeInTheDocument();
  });
});
