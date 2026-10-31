import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Sent {
  route: string;
  body: unknown;
}

const laptop = {
  id: "p1",
  name: "Laptop",
  created_at: "2026-10-31T12:00:00Z",
};

const options = {
  challenge: "AQ",
  user_id: "Ag",
  user_name: "a@b.c",
  exclude_credentials: [],
};

const created = {
  passkey: { ...laptop, id: "p2", name: "Phone" },
  recovery_codes: ["ABCDEFGHIJKLMNOP"],
};

const field = { exact: false, selector: "input" };

function api(
  passkeys: unknown[],
  sent: Sent[],
  overrides: Record<
    string,
    (req: Request) => Response | Promise<Response>
  > = {},
) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        region: "BR",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/me/second-factor": () =>
      json(200, { totp: false, passkeys, recovery_codes_left: 0 }),
    "POST /api/v1/me/passkeys/options": () => json(200, options),
    "POST /api/v1/me/passkeys": async (req) => {
      sent.push({ route: "create", body: await req.json() });
      return json(201, created);
    },
    "POST /api/v1/me/passkeys/p1/remove": async (req) => {
      sent.push({ route: "remove", body: await req.json() });
      return new Response(null, { status: 204 });
    },
    ...overrides,
  });
}

function stubBrowser(create: unknown) {
  vi.stubGlobal("PublicKeyCredential", vi.fn());
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "credentials", {
    value: { create },
    configurable: true,
  });
}

const credential = {
  response: {
    clientDataJSON: new Uint8Array([1]).buffer,
    getAuthenticatorData: () => new Uint8Array([2]).buffer,
    getPublicKey: () => new Uint8Array([3]).buffer,
    getPublicKeyAlgorithm: () => -7,
  },
};

async function section() {
  const heading = await screen.findByRole("heading", {
    name: pt["settings.security.title"],
    level: 2,
  });
  const root = heading.closest("section");
  if (root === null) throw new Error("no section around the heading");
  return within(root);
}

async function addPasskey(name: string) {
  const view = await section();
  await userEvent.click(
    await view.findByRole("button", { name: pt["security.passkeys.add"] }),
  );
  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.type(
    dialog.getByLabelText(pt["security.passkeys.name"], field),
    name,
  );
  await userEvent.click(
    dialog.getByRole("button", { name: pt["security.passkeys.create"] }),
  );
  return dialog;
}

async function removeLaptop(password: string) {
  const view = await section();
  await userEvent.click(
    await view.findByRole("button", { name: pt["security.passkeys.remove"] }),
  );
  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.type(
    dialog.getByLabelText(pt["login.password"], field),
    password,
  );
  await userEvent.click(
    dialog.getByRole("button", { name: pt["security.passkeys.remove"] }),
  );
  return dialog;
}

describe("passkeys in the security pane", () => {
  beforeEach(() => {
    stubBrowser(vi.fn().mockResolvedValue(credential));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "credentials");
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
  });

  it("shows the empty text and the add button", async () => {
    await renderApp("/settings?section=security", { fetch: api([], []) });
    const view = await section();

    expect(await view.findByText(pt["security.passkeys.empty"])).toBeVisible();
    expect(
      view.getByRole("button", { name: pt["security.passkeys.add"] }),
    ).toBeVisible();
  });

  it("shows the unavailable text and no add button outside a secure context", async () => {
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
    });
    await renderApp("/settings?section=security", { fetch: api([], []) });
    const view = await section();

    expect(
      await view.findByText(pt["security.passkeys.unavailable"]),
    ).toBeVisible();
    expect(
      view.queryByRole("button", { name: pt["security.passkeys.add"] }),
    ).toBeNull();
  });

  it("creates a passkey and shows the recovery codes", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=security", { fetch: api([], sent) });
    await addPasskey("Phone");

    expect(await screen.findByText("ABCD EFGH IJKL MNOP")).toBeVisible();
    expect(sent).toEqual([
      {
        route: "create",
        body: {
          name: "Phone",
          client_data_json: "AQ",
          authenticator_data: "Ag",
          public_key: "Aw",
          algorithm: -7,
        },
      },
    ]);
  });

  it("closes the dialog without recovery codes when none are issued", async () => {
    const fetch = api([], [], {
      "POST /api/v1/me/passkeys": () =>
        json(201, { ...created, recovery_codes: [] }),
    });
    await renderApp("/settings?section=security", { fetch });
    await addPasskey("Phone");

    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("shows the cancelled text when the browser refuses", async () => {
    stubBrowser(
      vi.fn().mockRejectedValue(new DOMException("", "NotAllowedError")),
    );
    await renderApp("/settings?section=security", { fetch: api([], []) });
    const dialog = await addPasskey("Phone");

    expect(
      await dialog.findByText(pt["security.passkeys.cancelled"]),
    ).toBeVisible();
  });

  it("shows the problem when the server rejects the passkey", async () => {
    const fetch = api([], [], {
      "POST /api/v1/me/passkeys": () => problem(422, "passkey_invalid"),
    });
    await renderApp("/settings?section=security", { fetch });
    const dialog = await addPasskey("Phone");

    expect(
      await dialog.findByText(pt["problem.passkey_invalid"]),
    ).toBeVisible();
  });

  it("removes a passkey with the password", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=security", {
      fetch: api([laptop], sent),
    });
    await removeLaptop("x");

    await vi.waitFor(() => {
      expect(sent).toEqual([{ route: "remove", body: { password: "x" } }]);
    });
  });

  it("shows the problem when the passkey is gone", async () => {
    const fetch = api([laptop], [], {
      "POST /api/v1/me/passkeys/p1/remove": () =>
        problem(404, "passkey_not_found"),
    });
    await renderApp("/settings?section=security", { fetch });
    const dialog = await removeLaptop("x");

    expect(
      await dialog.findByText(pt["problem.passkey_not_found"]),
    ).toBeVisible();
  });
});
