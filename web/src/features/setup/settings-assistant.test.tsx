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

const groq = {
  id: "p1",
  preset: "groq",
  name: "Groq",
  base_url: "https://api.groq.com/openai/v1",
  has_key: true,
  notice: "provider_terms",
  instance: false,
};
const instance = {
  id: "aistudio",
  preset: "gemini",
  name: "aistudio",
  base_url: "",
  has_key: true,
  notice: "trains",
  instance: true,
};
const presets = [
  {
    id: "gemini",
    api: "gemini",
    base_url: "https://generativelanguage.googleapis.com",
    key_required: true,
    notice: "trains",
    models: [],
  },
  {
    id: "groq",
    api: "openai",
    base_url: "https://api.groq.com/openai/v1",
    key_required: true,
    notice: "provider_terms",
    models: [],
  },
];
const customChat = {
  id: "assistant.chat",
  needs: ["tools"],
  sends_financial_data: true,
  default: false,
  targets: [
    {
      provider_id: "p1",
      provider_name: "Groq",
      preset: "groq",
      notice: "provider_terms",
      model: "openai/gpt-oss-120b",
      capabilities: ["tools"],
    },
  ],
};
const defaultSuggest = {
  id: "capture.suggest",
  needs: ["structured_output"],
  sends_financial_data: true,
  default: true,
  targets: [
    {
      provider_id: "aistudio",
      provider_name: "aistudio",
      preset: "gemini",
      notice: "trains",
      model: "gemini-3.5-flash-lite",
      capabilities: ["tools", "structured_output"],
    },
  ],
};

function api(
  sent: Sent[],
  answers: { create?: () => Response; models?: () => Response } = {},
) {
  const record =
    (route: string, answer: () => Response) => async (req: Request) => {
      sent.push({ route, body: await req.json() });
      return answer();
    };
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
    "GET /api/v1/assistant/presets": () => json(200, { items: presets }),
    "GET /api/v1/assistant/providers": () =>
      json(200, { items: [groq, instance] }),
    "GET /api/v1/assistant/uses": () =>
      json(200, { items: [defaultSuggest, customChat] }),
    "POST /api/v1/assistant/providers": record(
      "POST /assistant/providers",
      answers.create ?? (() => json(201, groq)),
    ),
    "GET /api/v1/assistant/providers/p1/models":
      answers.models ?? (() => json(200, { items: ["llama", "qwen"] })),
    "GET /api/v1/assistant/usage": () =>
      json(200, {
        items: [
          {
            provider_id: "aistudio",
            provider_name: "aistudio",
            preset: "gemini",
            instance: true,
            model: "gemini-3.5-flash-lite",
            today_requests: 80,
            today_errors: 2,
            today_tokens: 1200,
            period_requests: 300,
            period_tokens: 9000,
            period_days: 30,
            requests_per_day: 100,
          },
        ],
      }),
    "PUT /api/v1/assistant/usage/limits": record(
      "PUT /limits",
      () => new Response(null, { status: 204 }),
    ),
    "PUT /api/v1/assistant/uses/assistant.chat/chain": record(
      "PUT /chain",
      () => json(200, { ...customChat, default: true }),
    ),
  });
}

async function section() {
  const heading = await screen.findByRole("heading", {
    name: pt["settings.assistant.title"],
  });
  const root = heading.closest("section");
  if (root === null) throw new Error("no section around the heading");
  return within(root);
}

// The usage row of a target: its label is also the chain description of the use.
async function usageRow(
  view: Awaited<ReturnType<typeof section>>,
  label: string,
) {
  const matches = await view.findAllByText(label);
  const row = matches
    .map((element) => element.closest("li"))
    .find(
      (li) =>
        li !== null &&
        within(li).queryByRole("button", {
          name: pt["assistant.usage.limits"],
        }) !== null,
    );
  if (row === undefined || row === null)
    throw new Error(`no usage row for ${label}`);
  return row;
}

describe("assistant settings", () => {
  it("lists providers with their notice, never a key, and warns on a training provider", async () => {
    await renderApp("/settings", { fetch: api([]) });
    const view = await section();
    expect(await view.findByText("Groq")).toBeVisible();
    expect(view.getByText(pt["assistant.provider.instance"])).toBeVisible();
    expect(view.getByText(pt["assistant.notice.trains"])).toBeVisible();
    expect(
      view.getByText(
        `${pt["assistant.preset.groq"]} · ${pt["assistant.provider.keyStored"]}`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        pt["assistant.use.trains"].replace("{provider}", "aistudio"),
      ),
    ).toBeVisible();
  });

  it("shows a refused key at its field and in the summary", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", {
      fetch: api(sent, {
        create: () =>
          problem(422, "key_required", {
            errors: [{ field: "key", message: "is required by the preset" }],
          }),
      }),
    });
    const view = await section();
    await userEvent.click(
      await view.findByRole("button", { name: pt["assistant.provider.add"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: pt["assistant.field.name"] }),
      "Groq",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: pt["assistant.create"] }),
    );
    expect(
      await within(dialog).findByText("is required by the preset"),
    ).toBeVisible();
    expect(within(dialog).getByText(pt["problem.key_required"])).toBeVisible();
    expect(sent).toEqual([
      {
        route: "POST /assistant/providers",
        body: { preset: "gemini", name: "Groq" },
      },
    ]);
  });

  it("lists a provider's models", async () => {
    await renderApp("/settings", { fetch: api([]) });
    const view = await section();
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["assistant.provider.models"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("qwen")).toBeVisible();
  });

  it("says a refused key when listing models", async () => {
    await renderApp("/settings", {
      fetch: api([], { models: () => problem(502, "provider_unauthorized") }),
    });
    const view = await section();
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["assistant.provider.models"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(pt["problem.provider_unauthorized"]),
    ).toBeVisible();
  });

  it("restores a use's default chain with an empty list", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", { fetch: api(sent) });
    const view = await section();
    const row = (
      await view.findByText(pt["assistant.use.assistant.chat"])
    ).closest("li");
    if (row === null) throw new Error("no row for the chat use");
    await userEvent.click(
      within(row).getByRole("button", { name: pt["assistant.use.edit"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: pt["assistant.chain.restore"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "PUT /chain", body: { targets: [] } }]);
    });
  });

  it("shows today's usage against the limit and a zero row for an unused chain target", async () => {
    await renderApp("/settings", { fetch: api([]) });
    const view = await section();
    expect(
      await view.findByText(
        "Hoje: 80 de 100 requisições, 1.200 tokens · 2 com erro · 30 dias: 300 requisições, 9.000 tokens",
      ),
    ).toBeVisible();
    expect(view.getByText(pt["assistant.usage.near"])).toBeVisible();
    expect(await usageRow(view, "Groq · openai/gpt-oss-120b")).toBeVisible();
  });

  it("sends the declared limits", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", { fetch: api(sent) });
    const view = await section();
    const row = await usageRow(view, "Groq · openai/gpt-oss-120b");
    await userEvent.click(
      within(row).getByRole("button", { name: pt["assistant.usage.limits"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("spinbutton", {
        name: pt["assistant.limits.requests"],
      }),
      "1000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: pt["assistant.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "PUT /limits",
          body: {
            provider_id: "p1",
            model: "openai/gpt-oss-120b",
            requests_per_day: 1000,
          },
        },
      ]);
    });
  });
});
