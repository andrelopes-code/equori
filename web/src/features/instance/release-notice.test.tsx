import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const storageKey = "equori.overview.dismissedRelease";

function release(version: string) {
  return {
    version,
    url: `https://example.org/releases/${version}`,
    checked_at: "2026-11-20T02:30:00Z",
  };
}

function api(role: string, status: object) {
  const calls: string[] = [];
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
      "GET /api/v1/instance/version": () => {
        calls.push("version");
        return json(200, status);
      },
    }),
  );
  return { fetch, calls };
}

const notice = catalogEn["overview.release"].replace("{version}", "v1.0.1");

describe("Release notice on the overview (P13 A159)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a newer release with its notes and hides it once dismissed", async () => {
    const a = api("admin", {
      version: "v1.0.0",
      update_check: true,
      latest: release("v1.0.1"),
      newer: true,
    });
    await renderApp("/", { fetch: a.fetch });

    expect(await screen.findByText(notice)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: new RegExp(catalogEn["overview.release.notes"]),
      }),
    ).toHaveAttribute("href", release("v1.0.1").url);

    const alert = screen.getByText(notice).closest("section") ?? document.body;
    await userEvent.click(
      within(alert).getByRole("button", {
        name: catalogEn["overview.release.dismiss"],
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText(notice)).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(storageKey)).toBe("v1.0.1");
  });

  it("shows a release newer than the dismissed one", async () => {
    localStorage.setItem(storageKey, "v1.0.1");
    const a = api("admin", {
      version: "v1.0.0",
      update_check: true,
      latest: release("v1.0.2"),
      newer: true,
    });
    await renderApp("/", { fetch: a.fetch });

    expect(
      await screen.findByText(
        catalogEn["overview.release"].replace("{version}", "v1.0.2"),
      ),
    ).toBeInTheDocument();
  });

  it("shows nothing when no newer release exists", async () => {
    const a = api("admin", {
      version: "v1.0.0",
      update_check: true,
      latest: release("v1.0.0"),
      newer: false,
    });
    await renderApp("/", { fetch: a.fetch });

    await waitFor(() => {
      expect(a.calls).toContain("version");
    });
    expect(
      screen.queryByText(/of equori is available/),
    ).not.toBeInTheDocument();
  });

  it("shows nothing to a member and does not request the version", async () => {
    const a = api("member", {
      version: "v1.0.0",
      update_check: true,
      latest: release("v1.0.1"),
      newer: true,
    });
    await renderApp("/", { fetch: a.fetch });

    await screen.findByRole("heading", { name: catalogEn["nav.overview"] });
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
    expect(a.calls).toEqual([]);
  });
});
