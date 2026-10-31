import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Sent {
  route: string;
  body: unknown;
}

interface Factor {
  totp: boolean;
  passkeys: unknown[];
  recovery_codes_left: number;
}

const off: Factor = { totp: false, passkeys: [], recovery_codes_left: 0 };
const on: Factor = { totp: true, passkeys: [], recovery_codes_left: 10 };
const setup = {
  secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  uri: "otpauth://totp/equori:a@b.c?secret=GEZD&issuer=equori",
};

function api(
  factor: Factor,
  sent: Sent[],
  overrides: Record<string, () => Response | Promise<Response>> = {},
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
    "GET /api/v1/me/second-factor": () => json(200, factor),
    "POST /api/v1/me/totp": () => json(200, setup),
    "POST /api/v1/me/totp/confirm": async (req) => {
      sent.push({ route: "confirm", body: await req.json() });
      return json(200, { recovery_codes: ["ABCDEFGHIJKLMNOP"] });
    },
    "POST /api/v1/me/totp/disable": async (req) => {
      sent.push({ route: "disable", body: await req.json() });
      return new Response(null, { status: 204 });
    },
    "POST /api/v1/me/recovery-codes": async (req) => {
      sent.push({ route: "regenerate", body: await req.json() });
      return json(200, { recovery_codes: ["ABCDEFGHIJKLMNOP"] });
    },
    ...overrides,
  });
}

const field = { exact: false, selector: "input" };

async function section() {
  const heading = await screen.findByRole("heading", {
    name: pt["settings.security.title"],
    level: 2,
  });
  const root = heading.closest("section");
  if (root === null) throw new Error("no section around the heading");
  return within(root);
}

async function openTotpDialog(view: Awaited<ReturnType<typeof section>>) {
  await userEvent.click(
    await view.findByRole("button", { name: pt["security.totp.enable"] }),
  );
  return within(await screen.findByRole("dialog"));
}

async function confirmPassword(password: string, action: string) {
  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.type(
    dialog.getByLabelText(pt["login.password"], field),
    password,
  );
  await userEvent.click(dialog.getByRole("button", { name: action }));
  return dialog;
}

describe("security settings", () => {
  it("shows the authenticator app off and no recovery codes", async () => {
    await renderApp("/settings?section=security", { fetch: api(off, []) });
    const view = await section();

    expect(await view.findByText(pt["security.off"])).toBeVisible();
    expect(view.getByText(pt["security.recovery.none"])).toBeVisible();
  });

  it("shows the key and the QR code when the set-up starts", async () => {
    await renderApp("/settings?section=security", { fetch: api(off, []) });
    const dialog = await openTotpDialog(await section());

    expect(
      await dialog.findByText("GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ"),
    ).toBeVisible();
    expect(
      dialog.getByRole("img", { name: pt["security.totp.qr"] }),
    ).toBeVisible();
  });

  it("confirms the code and shows the recovery codes", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=security", { fetch: api(off, sent) });
    const dialog = await openTotpDialog(await section());

    await userEvent.type(
      await dialog.findByLabelText(pt["security.totp.code"], field),
      "123456",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: pt["security.totp.confirm"] }),
    );

    expect(await screen.findByText("ABCD EFGH IJKL MNOP")).toBeVisible();
    expect(sent).toEqual([{ route: "confirm", body: { code: "123456" } }]);
  });

  it("shows a wrong code in the dialog", async () => {
    const fetch = api(off, [], {
      "POST /api/v1/me/totp/confirm": () => problem(422, "totp_code_invalid"),
    });
    await renderApp("/settings?section=security", { fetch });
    const dialog = await openTotpDialog(await section());

    await userEvent.type(
      await dialog.findByLabelText(pt["security.totp.code"], field),
      "123456",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: pt["security.totp.confirm"] }),
    );

    expect(
      await dialog.findByText(pt["problem.totp_code_invalid"]),
    ).toBeVisible();
  });

  it("shows a missing secret key in the group", async () => {
    const fetch = api(off, [], {
      "POST /api/v1/me/totp": () => problem(409, "secret_key_missing"),
    });
    await renderApp("/settings?section=security", { fetch });
    const view = await section();

    await userEvent.click(
      await view.findByRole("button", { name: pt["security.totp.enable"] }),
    );

    expect(
      await view.findByText(pt["problem.secret_key_missing"]),
    ).toBeVisible();
  });

  it("turns the authenticator app off with the password", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=security", { fetch: api(on, sent) });
    const view = await section();

    await userEvent.click(
      await view.findByRole("button", { name: pt["security.totp.disable"] }),
    );
    await confirmPassword("x", pt["security.totp.disable"]);

    await waitForClose();
    expect(sent).toEqual([{ route: "disable", body: { password: "x" } }]);
  });

  it("keeps the dialog open on a wrong password", async () => {
    const fetch = api(on, [], {
      "POST /api/v1/me/totp/disable": () => problem(403, "password_invalid"),
    });
    await renderApp("/settings?section=security", { fetch });
    const view = await section();

    await userEvent.click(
      await view.findByRole("button", { name: pt["security.totp.disable"] }),
    );
    const dialog = await confirmPassword("x", pt["security.totp.disable"]);

    expect(
      await dialog.findByText(pt["problem.password_invalid"]),
    ).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("regenerates the recovery codes with the password", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=security", { fetch: api(on, sent) });
    const view = await section();

    expect(await view.findByText("Códigos restantes: 10")).toBeVisible();
    await userEvent.click(
      view.getByRole("button", { name: pt["security.recovery.regenerate"] }),
    );
    await confirmPassword("x", pt["security.recovery.regenerate"]);

    expect(await screen.findByText("ABCD EFGH IJKL MNOP")).toBeVisible();
    expect(sent).toEqual([{ route: "regenerate", body: { password: "x" } }]);
  });

  it("counts the recovery codes of a member with only a passkey", async () => {
    const passkey = {
      id: "p1",
      name: "Laptop",
      created_at: "2026-10-31T12:00:00Z",
    };
    await renderApp("/settings?section=security", {
      fetch: api({ ...off, passkeys: [passkey], recovery_codes_left: 10 }, []),
    });
    const view = await section();

    expect(await view.findByText("Códigos restantes: 10")).toBeVisible();
    expect(view.queryByText(pt["security.recovery.none"])).toBeNull();
  });

  it("states no factor before the second factor answers", async () => {
    await renderApp("/settings?section=security", {
      fetch: api(off, [], {
        "GET /api/v1/me/second-factor": () =>
          new Promise<Response>(() => undefined),
      }),
    });
    const view = await section();

    expect(view.queryByText(pt["security.off"])).toBeNull();
    expect(view.queryByText(pt["security.passkeys.empty"])).toBeNull();
    expect(view.queryByText(pt["security.recovery.none"])).toBeNull();
  });
});

async function waitForClose() {
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
}
