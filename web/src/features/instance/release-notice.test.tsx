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

const notice = catalogEn["overview.release"]
  .replace("{version}", "v1.0.1")
  .replace("{current}", "v1.0.0");

const windowsCommand =
  "irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1 | iex";
const unixCommand =
  "curl -fsSL https://github.com/andrelopes-code/equori/releases/latest/download/install.sh | sh";

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
      distribution: "compose",
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
      distribution: "compose",
    });
    await renderApp("/", { fetch: a.fetch });

    expect(
      await screen.findByText(
        catalogEn["overview.release"]
          .replace("{version}", "v1.0.2")
          .replace("{current}", "v1.0.0"),
      ),
    ).toBeInTheDocument();
  });

  it("shows nothing when no newer release exists", async () => {
    const a = api("admin", {
      version: "v1.0.0",
      update_check: true,
      latest: release("v1.0.0"),
      newer: false,
      distribution: "compose",
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
      distribution: "compose",
    });
    await renderApp("/", { fetch: a.fetch });

    await screen.findByRole("heading", { name: catalogEn["nav.overview"] });
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
    expect(a.calls).toEqual([]);
  });

  // S269 (A195.2)
  it("shows the upgrade commands of a compose instance and copies one", async () => {
    const user = userEvent.setup();
    const a = api("admin", {
      version: "v1.0.0",
      update_check: true,
      latest: release("v1.0.1"),
      newer: true,
      distribution: "compose",
    });
    await renderApp("/", { fetch: a.fetch });

    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["overview.release.upgrade"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const windows = codeBlock(dialog, catalogEn["upgrade.compose.windows"]);
    await user.click(within(windows).getByRole("button", { name: /copy/i }));

    expect(windows).toHaveTextContent(windowsCommand);
    expect(
      codeBlock(dialog, catalogEn["upgrade.compose.unix"]),
    ).toHaveTextContent(unixCommand);
    expect(await navigator.clipboard.readText()).toBe(windowsCommand);
  });

  // S270 (A195.2)
  it("shows no compose command to a managed instance", async () => {
    const a = api("admin", {
      version: "v1.0.0",
      update_check: true,
      latest: release("v1.0.1"),
      newer: true,
      distribution: "managed",
    });
    await renderApp("/", { fetch: a.fetch });

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["overview.release.upgrade"],
      }),
    );
    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveTextContent(catalogEn["upgrade.managed"]);
    expect(dialog).not.toHaveTextContent(/irm |curl /);
  });
});

// The block has no role (code-block, Accessibility); its title names it.
function codeBlock(dialog: HTMLElement, title: string): HTMLElement {
  const block = within(dialog)
    .getByText(title)
    .closest<HTMLElement>('[data-ui="code-block"]');
  if (block === null) throw new Error(`no code block titled ${title}`);
  return block;
}
