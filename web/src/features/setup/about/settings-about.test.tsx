import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const release = {
  version: "v1.0.1",
  url: "https://example.org/releases/v1.0.1",
  checked_at: "2026-11-20T02:30:00Z",
};

function api(version: object) {
  const sent: unknown[] = [];
  const fetch = fakeApi(
    accountRoutes({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language: "en",
          region: "BR",
        }),
      "GET /api/v1/instance/version": () => json(200, version),
      "PUT /api/v1/instance/version/update-check": async (req: Request) => {
        sent.push(await req.json());
        return json(200, version);
      },
    }),
  );
  return { fetch, sent };
}

function section() {
  return screen.getByRole("region", {
    name: catalogEn["settings.about.title"],
  });
}

describe("About section (P13 A158, A159)", () => {
  it("shows the version and a newer release with its notes", async () => {
    const a = api({
      version: "v1.0.0",
      update_check: true,
      latest: release,
      newer: true,
    });
    await renderApp("/settings?section=about", { fetch: a.fetch });

    expect(
      await within(section()).findByText("Version v1.0.0"),
    ).toBeInTheDocument();
    expect(
      within(section()).getByText("Version v1.0.1 is available."),
    ).toBeInTheDocument();
    expect(
      within(section()).getByRole("link", {
        name: new RegExp(catalogEn["about.latest.notes"]),
      }),
    ).toHaveAttribute("href", release.url);
  });

  it("stores the answer to the update check", async () => {
    const a = api({
      version: "v1.0.0",
      update_check: null,
      latest: null,
      newer: false,
    });
    await renderApp("/settings?section=about", { fetch: a.fetch });

    await userEvent.click(
      await within(section()).findByRole("radio", {
        name: catalogEn["about.updateCheck.no"],
      }),
    );

    await waitFor(() => {
      expect(a.sent).toEqual([{ update_check: false }]);
    });
  });

  it("links the diagnostic file", async () => {
    const a = api({
      version: "v1.0.0",
      update_check: false,
      latest: null,
      newer: false,
    });
    await renderApp("/settings?section=about", { fetch: a.fetch });

    expect(
      await within(section()).findByRole("link", {
        name: catalogEn["about.diagnostic"],
      }),
    ).toHaveAttribute("href", "/api/v1/instance/diagnostic");
  });
});
