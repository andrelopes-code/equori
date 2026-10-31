import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Status {
  backups: {
    state: "on" | "off";
    periodic_at: string | null;
    pre_migration_at: string | null;
    late: boolean;
  };
  copy: {
    state: string;
    copied_at: string | null;
    file: string | null;
    late: boolean;
  };
}

const on = {
  state: "on",
  periodic_at: "2026-11-18T01:00:00Z",
  pre_migration_at: null,
  late: false,
} as const;

const copyOk = { state: "ok", copied_at: null, file: null, late: false };

function status(patch: Partial<Status> = {}): Status {
  return { backups: on, copy: copyOk, ...patch };
}

function api(current: Status, role = "admin") {
  const sent: string[] = [];
  const fetch = fakeApi(
    accountRoutes({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role,
          language: "en",
          region: "BR",
        }),
      "GET /api/v1/instance/backup": () => json(200, current),
      "POST /api/v1/instance/backup": () => {
        sent.push("POST /instance/backup");
        return json(200, current);
      },
      "PUT /api/v1/instance/backup/copy-password": async (req: Request) => {
        const body = (await req.json()) as { password: string };
        sent.push(`PUT ${body.password}`);
        return new Response(null, { status: 204 });
      },
    }),
  );
  return { fetch, sent };
}

const open = (fetch: ReturnType<typeof api>["fetch"]) =>
  renderApp("/settings?section=backup", { fetch });

function section() {
  return screen.getByRole("region", {
    name: catalogEn["settings.backup.title"],
  });
}

describe("Backup section (P13 A154, A155, A157)", () => {
  it("says when automatic backups are off", async () => {
    const a = api(status({ backups: { ...on, state: "off" } }));
    await open(a.fetch);

    expect(
      await within(section()).findByText(catalogEn["backup.off"]),
    ).toBeInTheDocument();
  });

  it("warns when the daily backup is late", async () => {
    const a = api(status({ backups: { ...on, late: true } }));
    await open(a.fetch);

    expect(
      await within(section()).findByText(catalogEn["backup.late"]),
    ).toBeInTheDocument();
  });

  it("shows a copy folder that cannot be written and a late copy", async () => {
    const a = api(
      status({
        copy: { ...copyOk, state: "folder_not_writable", late: true },
      }),
    );
    await open(a.fetch);

    expect(
      await within(section()).findByText(
        catalogEn["backup.copy.folder_not_writable"],
      ),
    ).toBeInTheDocument();
    expect(
      within(section()).getByText(catalogEn["backup.copy.late"]),
    ).toBeInTheDocument();
  });

  it("says that no copy exists yet", async () => {
    const a = api(status());
    await open(a.fetch);

    expect(
      await within(section()).findByText(catalogEn["backup.copy.none"]),
    ).toBeInTheDocument();
  });

  it("backs up now", async () => {
    const a = api(status());
    await open(a.fetch);

    await userEvent.click(
      await within(section()).findByRole("button", {
        name: catalogEn["backup.run"],
      }),
    );

    await waitFor(() => {
      expect(a.sent).toEqual(["POST /instance/backup"]);
    });
  });

  it("rejects two different copy passwords without a request", async () => {
    const a = api(status());
    await open(a.fetch);
    await userEvent.type(
      await within(section()).findByLabelText(
        catalogEn["backup.password.field"],
      ),
      "first password 1",
    );
    await userEvent.type(
      within(section()).getByLabelText(catalogEn["backup.password.repeat"]),
      "other password 2",
    );

    await userEvent.click(
      within(section()).getByRole("button", {
        name: catalogEn["backup.password.save"],
      }),
    );

    expect(
      await within(section()).findByText(catalogEn["backup.password.mismatch"]),
    ).toBeInTheDocument();
    expect(a.sent).toEqual([]);
  });

  it("sends equal copy passwords of 12 characters", async () => {
    const a = api(status());
    await open(a.fetch);
    await userEvent.type(
      await within(section()).findByLabelText(
        catalogEn["backup.password.field"],
      ),
      "twelve chars",
    );
    await userEvent.type(
      within(section()).getByLabelText(catalogEn["backup.password.repeat"]),
      "twelve chars",
    );

    await userEvent.click(
      within(section()).getByRole("button", {
        name: catalogEn["backup.password.save"],
      }),
    );

    await waitFor(() => {
      expect(a.sent).toEqual(["PUT twelve chars"]);
    });
  });

  it("shows a member nothing", async () => {
    const a = api(status(), "member");
    await open(a.fetch);

    await screen.findByRole("navigation", {
      name: catalogEn["settings.contents"],
    });
    expect(
      screen.queryByRole("region", {
        name: catalogEn["settings.backup.title"],
      }),
    ).not.toBeInTheDocument();
    expect(a.fetch.calls).not.toContain("GET /api/v1/instance/backup");
  });
});
