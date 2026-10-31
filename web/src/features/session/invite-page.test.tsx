import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reloadHome } from "@/features/session";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

vi.mock("@/features/session/reload-home", () => ({ reloadHome: vi.fn() }));

const storedKey = "equori.invite.token";

const preview = {
  books_name: "Casal",
  inviter_email: "ana@example.com",
  role: "write",
  email: "caio@example.com",
  member_exists: false,
};

interface Calls {
  previews: unknown[];
  accepts: unknown[];
}

function api(
  calls: Calls,
  opts: { preview?: () => Response; accept?: () => Response } = {},
) {
  return fakeApi({
    "GET /api/v1/setup": () => json(200, { required: false }),
    "POST /api/v1/invitations/preview": async (req) => {
      calls.previews.push(await req.json());
      return opts.preview?.() ?? json(200, preview);
    },
    "POST /api/v1/invitations/accept": async (req) => {
      calls.accepts.push(await req.json());
      return opts.accept?.() ?? new Response(null, { status: 204 });
    },
  });
}

function newCalls(): Calls {
  return { previews: [], accepts: [] };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(reloadHome).mockClear();
});

describe("invite page", () => {
  it("accepts as a new member with a password and a language", async () => {
    const calls = newCalls();
    const { router } = await renderApp("/invite#token=tok_abc", {
      fetch: api(calls),
    });
    expect(
      await screen.findByText(
        "ana@example.com invites caio@example.com to the book Casal as Editor.",
      ),
    ).toBeInTheDocument();
    expect(calls.previews).toEqual([{ token: "tok_abc" }]);
    expect(router.state.location.hash).toBe("");
    expect(sessionStorage.getItem(storedKey)).toBe("tok_abc");

    const actor = userEvent.setup();
    await actor.type(
      await screen.findByLabelText(catalogEn["setup.password"], {
        exact: false,
        selector: "input",
      }),
      "correct horse battery",
    );
    await actor.click(
      screen.getByRole("button", { name: catalogEn["invite.accept"] }),
    );

    await waitFor(() => {
      expect(reloadHome).toHaveBeenCalledTimes(1);
    });
    expect(calls.accepts).toEqual([
      { token: "tok_abc", password: "correct horse battery", language: "en" },
    ]);
    expect(sessionStorage.getItem(storedKey)).toBeNull();
  });

  it("keeps the token when an existing member has no session", async () => {
    const calls = newCalls();
    const { router } = await renderApp("/invite#token=tok_abc", {
      fetch: api(calls, {
        preview: () => json(200, { ...preview, member_exists: true }),
        accept: () => problem(401, "unauthenticated"),
      }),
    });
    const accept = await screen.findByRole("button", {
      name: catalogEn["invite.accept"],
    });
    expect(
      screen.queryByLabelText(catalogEn["setup.password"], { exact: false }),
    ).toBeNull();

    await userEvent.setup().click(accept);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(router.state.location.search).toEqual({ redirect: "/invite" });
    expect(calls.accepts).toEqual([{ token: "tok_abc" }]);
    expect(sessionStorage.getItem(storedKey)).toBe("tok_abc");
  });

  it("reads the stored token when the address has no fragment", async () => {
    sessionStorage.setItem(storedKey, "tok_abc");
    const calls = newCalls();
    await renderApp("/invite", { fetch: api(calls) });

    await screen.findByText(/ana@example.com invites/);

    expect(calls.previews).toEqual([{ token: "tok_abc" }]);
  });

  it("forgets the token of an invitation that does not exist", async () => {
    const calls = newCalls();
    await renderApp("/invite#token=tok_abc", {
      fetch: api(calls, {
        preview: () => problem(404, "invitation_not_found"),
      }),
    });

    expect(
      await screen.findByText(catalogEn["problem.invitation_not_found"]),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(storedKey)).toBeNull();
  });

  it("shows the problem of an acceptance by another email", async () => {
    const calls = newCalls();
    await renderApp("/invite#token=tok_abc", {
      fetch: api(calls, {
        preview: () => json(200, { ...preview, member_exists: true }),
        accept: () => problem(403, "invitation_email_mismatch"),
      }),
    });

    await userEvent
      .setup()
      .click(
        await screen.findByRole("button", { name: catalogEn["invite.accept"] }),
      );

    expect(
      await screen.findByText(catalogEn["problem.invitation_email_mismatch"]),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(storedKey)).toBe("tok_abc");
  });

  it("explains the missing token without a request", async () => {
    const calls = newCalls();
    await renderApp("/invite", { fetch: api(calls) });

    expect(
      await screen.findByText(catalogEn["invite.tokenMissing"]),
    ).toBeInTheDocument();
    expect(calls.previews).toHaveLength(0);
  });
});
