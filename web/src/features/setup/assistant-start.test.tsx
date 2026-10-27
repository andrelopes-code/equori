import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

vi.mock("@slotted/react/chart", () => ({
  Chart: ({ title }: { title: string }) => <figure aria-label={title} />,
}));

const preset = (id: string, api: string, key: boolean, notice: string) => ({
  id,
  api,
  base_url: "",
  key_required: key,
  notice,
  models: [],
});
const presets = [
  preset("gemini", "gemini", true, "trains"),
  preset("ollama", "openai", false, "local"),
  preset("lmstudio", "openai", false, "local"),
];
const own = {
  id: "p1",
  preset: "ollama",
  name: "Meu Ollama",
  base_url: "http://127.0.0.1:11434/v1",
  has_key: false,
  notice: "local",
  instance: false,
};
const instance = {
  ...own,
  id: "aistudio",
  preset: "gemini",
  name: "aistudio",
  instance: true,
  notice: "trains",
};

// Providers and the chat state the server answers; a deletion empties the list.
function api(
  state: {
    providers: unknown[];
    available: boolean;
    retryAt?: string;
    chatFails?: boolean;
    presets?: unknown[];
  },
  posts: unknown[] = [],
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
    "GET /api/v1/assistant/presets": () =>
      json(200, { items: state.presets ?? presets }),
    "GET /api/v1/assistant/providers": () =>
      json(200, { items: state.providers }),
    "GET /api/v1/assistant/chat": () =>
      state.chatFails === true
        ? problem(500, "internal_error")
        : json(200, {
            available: state.available,
            ...(state.retryAt === undefined ? {} : { retry_at: state.retryAt }),
          }),
    "GET /api/v1/assistant/uses": () => json(200, { items: [] }),
    "GET /api/v1/assistant/usage": () => json(200, { items: [] }),
    "GET /api/v1/assistant/usage/days": () => json(200, { items: [] }),
    "POST /api/v1/assistant/providers": async (req) => {
      posts.push(await req.json());
      return json(201, own);
    },
    "DELETE /api/v1/assistant/providers/p1": () => {
      state.providers = [];
      state.available = false;
      return new Response(null, { status: 204 });
    },
  });
}

async function section() {
  const heading = await screen.findByRole("heading", {
    name: pt["settings.assistant.title"],
  });
  const root = heading.closest("section");
  if (root === null) throw new Error("no section");
  return within(root);
}

const choice = (name: string) => screen.findByRole("button", { name });

describe("assistant start (S1)", () => {
  it("offers three ways to start without a provider", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [], available: false }),
    });
    const view = await section();
    const gemini = await choice(pt["assistant.start.gemini"]);
    await choice(pt["assistant.start.local"]);
    await choice(pt["assistant.start.external"]);
    expect(
      view.getByText(
        new RegExp(pt["assistant.notice.trains.detail"].slice(0, 40)),
      ),
    ).toBeVisible();
    expect(
      view.getByRole("link", {
        name: new RegExp(`^${pt["assistant.start.gemini.key"]}`),
      }),
    ).toHaveAttribute("href", pt["assistant.start.gemini.key_url"]);
    expect(gemini).toBeEnabled();
  });

  it.each([
    ["assistant.start.gemini", "Google Gemini"],
    ["assistant.start.local", "Ollama (local)"],
  ] as const)(
    "opens the provider dialog on %s with its service",
    async (key, service) => {
      await renderApp("/settings?section=assistant", {
        fetch: api({ providers: [], available: false }),
      });
      await userEvent.click(await choice(pt[key]));
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByText(service)).toBeInTheDocument();
    },
  );

  it("opens the external access section", async () => {
    const { router } = await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [], available: false }),
    });
    const navigate = vi.spyOn(router, "navigate");
    await userEvent.click(await choice(pt["assistant.start.external"]));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/settings",
        search: { section: "external_access" },
      }),
    );
  });

  // Review Focus 1 of phase 5.
  it("offers no choice when an instance provider serves the chat", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [instance], available: true }),
    });
    const view = await section();
    await view.findByText("aistudio");
    expect(
      screen.queryByRole("button", { name: pt["assistant.start.gemini"] }),
    ).toBeNull();
  });

  // Review Focus 2 of phase 5.
  it("returns to the choices when the last provider is deleted", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [own], available: true }),
    });
    const view = await section();
    await view.findByText("Meu Ollama");
    expect(
      screen.queryByRole("button", { name: pt["assistant.start.local"] }),
    ).toBeNull();
    await userEvent.click(
      view.getByRole("button", { name: pt["assistant.provider.delete"] }),
    );
    expect(await choice(pt["assistant.start.local"])).toBeVisible();
  });

  // Review Focus 4 of phase 5.
  it("keeps the choices when the dialog is cancelled", async () => {
    const posts: unknown[] = [];
    await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [], available: false }, posts),
    });
    await userEvent.click(await choice(pt["assistant.start.local"]));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(
      dialog.getByRole("button", { name: pt["detail.cancel"] }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(posts).toEqual([]);
    expect(await choice(pt["assistant.start.local"])).toBeVisible();
  });

  // Review Focus 5 of phase 5.
  it("reaches the choices by keyboard", async () => {
    const user = userEvent.setup();
    await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [], available: false }),
    });
    const local = await choice(pt["assistant.start.local"]);
    for (let i = 0; i < 80 && document.activeElement !== local; i++)
      await user.tab();
    expect(document.activeElement).toBe(local);
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  // Review of phase 5: an instance provider over its quota still serves the reader.
  it("offers no choice when the instance provider is over its limit", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api({
        providers: [instance],
        available: false,
        retryAt: "2099-01-01T00:00:00Z",
      }),
    });
    const view = await section();
    await view.findByText("aistudio");
    expect(
      screen.queryByRole("button", { name: pt["assistant.start.gemini"] }),
    ).toBeNull();
  });

  it("says when the chat state cannot be read", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [], available: false, chatFails: true }),
    });
    const view = await section();
    expect(
      await view.findByText(pt["problem.internal_error"]),
    ).toBeInTheDocument();
  });

  it("describes each choice to the reader of its button", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api({ providers: [], available: false }),
    });
    expect(
      await choice(pt["assistant.start.gemini"]),
    ).toHaveAccessibleDescription(
      new RegExp(pt["assistant.notice.trains.detail"].slice(0, 30)),
    );
  });

  it("falls back to the first preset the server offers", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api({
        providers: [],
        available: false,
        presets: [presets[0]],
      }),
    });
    await userEvent.click(await choice(pt["assistant.start.local"]));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Google Gemini")).toBeInTheDocument();
  });
});
