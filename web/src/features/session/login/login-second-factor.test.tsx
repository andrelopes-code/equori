import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const user = { id: 1, email: "a@b.c", role: "admin" };

const totpChallenge = { methods: ["totp", "recovery_code"], passkey: null };

const passkeyChallenge = {
  methods: ["totp", "passkey"],
  passkey: { challenge: "AQ", allow_credentials: ["AQIDBA"] },
};

const buffer = (...bytes: number[]) => new Uint8Array(bytes).buffer;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("PublicKeyCredential", vi.fn());
  setSecure(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "credentials");
  setSecure(true);
});

describe("second step of the login", () => {
  it("replaces the password form with the code form", async () => {
    const { fetch } = sessionApi({ challenge: totpChallenge });
    await renderApp("/login", { fetch });
    await signIn();

    expect(
      await screen.findByText(catalogEn["login.secondFactor.title"]),
    ).toBeInTheDocument();
    expect(getField(catalogEn["login.secondFactor.totp"])).toBeInTheDocument();
    expect(screen.queryByLabelText(catalogEn["login.password"])).toBeNull();
  });

  it("sends the authenticator code and reaches the home page", async () => {
    const { fetch, state } = sessionApi({ challenge: totpChallenge });
    const { router } = await renderApp("/login", { fetch });
    await signIn();
    await submitCode("123456");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(state.secondFactorBodies).toEqual(['{"totp_code":"123456"}']);
  });

  it("shows the problem text and keeps the code field on a wrong code", async () => {
    const { fetch } = sessionApi({
      challenge: totpChallenge,
      secondFactor: () => problem(401, "second_factor_invalid"),
    });
    await renderApp("/login", { fetch });
    await signIn();
    await submitCode("123456");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      catalogEn["problem.second_factor_invalid"],
    );
    expect(getField(catalogEn["login.secondFactor.totp"])).toBeInTheDocument();
  });

  it("sends a recovery code in upper case", async () => {
    const { fetch, state } = sessionApi({ challenge: totpChallenge });
    await renderApp("/login", { fetch });
    await signIn();
    const actor = userEvent.setup();
    await actor.click(
      await screen.findByRole("button", {
        name: catalogEn["login.secondFactor.useRecovery"],
      }),
    );
    await actor.type(
      getField(catalogEn["login.secondFactor.recovery"]),
      "abcdefghijklmnop",
    );
    await actor.click(
      screen.getByRole("button", {
        name: catalogEn["login.secondFactor.submit"],
      }),
    );

    await waitFor(() => {
      expect(state.secondFactorBodies).toEqual([
        '{"recovery_code":"ABCDEFGHIJKLMNOP"}',
      ]);
    });
  });

  it("returns to the password form with the expired message on unauthenticated", async () => {
    const { fetch } = sessionApi({
      challenge: totpChallenge,
      secondFactor: () => problem(401, "unauthenticated"),
    });
    await renderApp("/login", { fetch });
    await signIn();
    await submitCode("123456");

    expect(
      await screen.findByLabelText(catalogEn["login.password"], {
        exact: false,
        selector: "input",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      catalogEn["login.secondFactor.expired"],
    );
  });

  it("returns to the password form without a message on back", async () => {
    const { fetch } = sessionApi({ challenge: totpChallenge });
    await renderApp("/login", { fetch });
    await signIn();
    const actor = userEvent.setup();
    await actor.click(
      await screen.findByRole("button", {
        name: catalogEn["login.secondFactor.back"],
      }),
    );

    expect(
      await screen.findByLabelText(catalogEn["login.password"], {
        exact: false,
        selector: "input",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers only the recovery field when the challenge holds no totp", async () => {
    const { fetch } = sessionApi({
      challenge: { methods: ["recovery_code"], passkey: null },
    });
    await renderApp("/login", { fetch });
    await signIn();

    expect(
      await findField(catalogEn["login.secondFactor.recovery"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: catalogEn["login.secondFactor.useTotp"],
      }),
    ).toBeNull();
  });
});

describe("second step of the login with a passkey", () => {
  it("sends the assertion of the passkey", async () => {
    stubGet(
      vi.fn().mockResolvedValue({
        rawId: buffer(4),
        response: {
          clientDataJSON: buffer(1),
          authenticatorData: buffer(2),
          signature: buffer(5),
        },
      }),
    );
    const { fetch, state } = sessionApi({ challenge: passkeyChallenge });
    const { router } = await renderApp("/login", { fetch });
    await signIn();
    const actor = userEvent.setup();
    await actor.click(
      await screen.findByRole("button", {
        name: catalogEn["login.secondFactor.passkey"],
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(state.secondFactorBodies).toEqual([
      '{"passkey":{"credential_id":"BA","client_data_json":"AQ","authenticator_data":"Ag","signature":"BQ"}}',
    ]);
  });

  it("shows the failure when the browser rejects the passkey", async () => {
    stubGet(vi.fn().mockRejectedValue(new DOMException("", "NotAllowedError")));
    const { fetch } = sessionApi({ challenge: passkeyChallenge });
    await renderApp("/login", { fetch });
    await signIn();
    const actor = userEvent.setup();
    await actor.click(
      await screen.findByRole("button", {
        name: catalogEn["login.secondFactor.passkey"],
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      catalogEn["login.secondFactor.passkeyFailed"],
    );
  });

  it("draws no passkey button outside a secure context", async () => {
    setSecure(false);
    const { fetch } = sessionApi({ challenge: passkeyChallenge });
    await renderApp("/login", { fetch });
    await signIn();
    await screen.findByText(catalogEn["login.secondFactor.title"]);

    expect(
      screen.queryByRole("button", {
        name: catalogEn["login.secondFactor.passkey"],
      }),
    ).toBeNull();
  });
});

function sessionApi(opts: {
  challenge: unknown;
  secondFactor?: () => Response;
}) {
  const state = { loggedIn: false, secondFactorBodies: [] as string[] };
  const fetch = fakeApi({
    "GET /api/v1/me": () =>
      state.loggedIn ? json(200, user) : problem(401, "unauthenticated"),
    "POST /api/v1/session": () => json(202, opts.challenge),
    "POST /api/v1/session/second-factor": async (req) => {
      state.secondFactorBodies.push(await req.text());
      const response =
        opts.secondFactor?.() ?? new Response(null, { status: 204 });
      if (response.status === 204) state.loggedIn = true;
      return response;
    },
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/institutions": () => json(200, { items: [] }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
  });
  return { fetch, state };
}

async function signIn() {
  const actor = userEvent.setup();
  await actor.type(await findField(catalogEn["login.email"]), "a@b.c");
  await actor.type(getField(catalogEn["login.password"]), "pw");
  await actor.click(
    screen.getByRole("button", { name: catalogEn["login.submit"] }),
  );
}

async function submitCode(code: string) {
  const actor = userEvent.setup();
  await actor.type(await findField(catalogEn["login.secondFactor.totp"]), code);
  await actor.click(
    screen.getByRole("button", {
      name: catalogEn["login.secondFactor.submit"],
    }),
  );
}

// The required mark is part of the label text, so the label matches by substring. The selector
// excludes the password's reveal button, whose name also contains the label.
function getField(label: string) {
  return screen.getByLabelText(label, { exact: false, selector: "input" });
}

function findField(label: string) {
  return screen.findByLabelText(label, { exact: false, selector: "input" });
}

function stubGet(get: unknown) {
  Object.defineProperty(navigator, "credentials", {
    value: { get },
    configurable: true,
  });
}

function setSecure(value: boolean) {
  Object.defineProperty(window, "isSecureContext", {
    value,
    configurable: true,
  });
}
