import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { catalogEn as en } from "@/i18n/catalog.en";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { optionalName } from "@/testing/optional-name";
import { renderApp } from "@/testing/render-app";

// The chart engine renders thousands of nodes in jsdom, and each text query over the section
// scans them again on every mutation. The charts are checked on their data, in the table.
vi.mock("@slotted/react/chart", () => ({
  Chart: ({ title }: { title: string }) => <figure aria-label={title} />,
}));

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

const lackingUse = {
  id: "assistant.vision",
  needs: ["image_input", "tools"],
  sends_financial_data: false,
  default: true,
  targets: [
    {
      provider_id: "p1",
      provider_name: "Groq",
      preset: "groq",
      notice: "provider_terms",
      model: "llama",
      capabilities: ["tools"],
    },
  ],
};

function api(
  sent: Sent[],
  answers: {
    create?: () => Response;
    models?: (() => Response) | undefined;
    me?: { language: string; region: string };
    daysQueries?: string[];
    days?: boolean;
    providers?: unknown[];
    uses?: unknown[];
  } = {},
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
        language: answers.me?.language ?? "pt",
        region: answers.me?.region ?? "BR",
      }),
    "GET /api/v1/settings": () =>
      json(200, { base_currency: answers.me === undefined ? "BRL" : "EUR" }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/assistant/presets": () => json(200, { items: presets }),
    "GET /api/v1/assistant/providers": () =>
      json(200, { items: answers.providers ?? [groq, instance] }),
    "GET /api/v1/assistant/uses": () =>
      json(200, {
        items: answers.uses ?? [defaultSuggest, customChat, lackingUse],
      }),
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
    "GET /api/v1/assistant/usage/days": (req: Request) => {
      answers.daysQueries?.push(new URL(req.url).search);
      return json(200, {
        items:
          answers.days !== true
            ? []
            : [
                {
                  day: "2026-10-16",
                  provider_id: "aistudio",
                  model: "gemini-3.5-flash-lite",
                  requests: 40,
                  errors: 1,
                  tokens: 800,
                },
                {
                  day: "2026-10-16",
                  provider_id: "p1",
                  model: "llama",
                  requests: 5,
                  errors: 0,
                  tokens: 100,
                },
              ],
      });
    },
    "PUT /api/v1/assistant/usage/limits": record(
      "PUT /limits",
      () => new Response(null, { status: 204 }),
    ),
    "PUT /api/v1/assistant/uses/assistant.chat/chain": record(
      "PUT /chain",
      () => json(200, { ...customChat, default: true }),
    ),
    "PUT /api/v1/assistant/uses/capture.suggest/chain": record(
      "PUT /suggest-chain",
      () => json(200, defaultSuggest),
    ),
  });
}

// The shell applies the language of the profile before the section draws (BK21).
async function section(title = pt["settings.assistant.title"]) {
  const heading = await screen.findByRole("heading", { name: title });
  const root = heading.closest("section");
  if (root === null) throw new Error("no section around the heading");
  return within(root);
}

// The usage card starts closed (spec A8); jsdom draws a closed details as hidden.
async function openUsage(view: Awaited<ReturnType<typeof section>>) {
  const summary = (await view.findByText(pt["assistant.usage"])).closest(
    "summary",
  );
  const details = summary?.closest("details");
  if (details === null || details === undefined)
    throw new Error("no usage card");
  details.open = true;
  return details;
}

// The row of a use, by the name of the use.
async function useRow(
  view: Awaited<ReturnType<typeof section>>,
  label: string,
) {
  const li = (await view.findByText(label)).closest("li");
  if (li === null) throw new Error(`no row for ${label}`);
  return li;
}

// The usage row of a model: the model is also a stop of a route.
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

// An action of a provider row sits in the row's menu.
async function rowAction(
  view: Awaited<ReturnType<typeof section>>,
  provider: string,
  action: string,
) {
  // A usage row names its provider too, and a preset can carry the provider's name: the row is
  // the one in the providers list, found by its first text, the name.
  const list = await view.findByRole("list", {
    name: new RegExp(
      `^(${pt["assistant.providers"]}|${en["assistant.providers"]})$`,
    ),
  });
  const row = (await within(list).findAllByText(provider))[0]?.closest("li");
  if (row === null || row === undefined) throw new Error("no provider row");
  await userEvent.click(
    within(row).getByRole("button", {
      name: new RegExp(provider),
    }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
  return row;
}

describe("assistant settings", () => {
  it("lists providers with their notice in words, never a key, and warns on a training provider", async () => {
    await renderApp("/settings?section=assistant", { fetch: api([]) });
    const view = await section();
    const list = within(
      await view.findByRole("list", { name: pt["assistant.providers"] }),
    );
    expect((await list.findAllByText("Groq"))[0]).toBeVisible();
    expect(view.getByText(pt["assistant.provider.instance"])).toBeVisible();
    // A4: the notice stands once, in words, on the row of the provider that trains.
    expect(view.getByText(pt["assistant.notice.trains.row"])).toBeVisible();
    expect(
      view.getByText(pt["assistant.notice.provider_terms.row"]),
    ).toBeVisible();
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

  // A2, A3: the status names the model that answers the conversation and its provider.
  it("states the model that answers the conversation", async () => {
    await renderApp("/settings?section=assistant", { fetch: api([]) });
    const view = await section();
    const status = within(
      await view.findByRole("region", { name: pt["assistant.status"] }),
    );
    expect(
      status.getByRole("heading", {
        name: `${pt["assistant.status.answers"]} openai/gpt-oss-120b`,
      }),
    ).toBeVisible();
    expect(
      status.getByText(
        pt["assistant.status.provider"].replace("{name}", "Groq"),
      ),
    ).toBeVisible();
  });

  // A5 to A7: one note and one route per use, and no tag.
  it("draws per use its note and its route", async () => {
    await renderApp("/settings?section=assistant", { fetch: api([]) });
    const view = await section();
    const suggest = await useRow(view, pt["assistant.use.capture.suggest"]);
    expect(
      within(suggest).getByText(pt["assistant.note.default"]),
    ).toBeVisible();
    expect(
      within(suggest).getByRole("list", {
        name: pt["assistant.route.label"]
          .replace("{list}", "1. gemini-3.5-flash-lite")
          .replace("{model}", "gemini-3.5-flash-lite"),
      }),
    ).toBeVisible();
    expect(
      within(suggest)
        .getByText("gemini-3.5-flash-lite")
        .closest("[data-state]"),
    ).toHaveAttribute("data-state", "answering");
    const chat = await useRow(view, pt["assistant.use.assistant.chat"]);
    expect(within(chat).getByText(pt["assistant.note.custom"])).toBeVisible();
    const vision = await useRow(view, "assistant.vision");
    expect(
      within(vision).getByText(
        pt["assistant.note.lacks"]
          .replace("{model}", "llama")
          .replace("{list}", pt["assistant.capability.image_input"]),
      ),
    ).toBeVisible();
    expect(
      within(vision).getByText("llama").closest("[data-state]"),
    ).toHaveAttribute("data-state", "lacking");
    expect(
      within(vision).getByRole("list", {
        name: pt["assistant.route.labelNone"].replace("{list}", "1. llama"),
      }),
    ).toBeVisible();
    expect(view.queryByText(pt["assistant.use.sends"])).toBeNull();
    for (const row of [suggest, chat, vision])
      expect(row.querySelector('[data-ui="tag"]')).toBeNull();
  });

  it("words the notes and the usage in English for another region and base currency", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api([], { me: { language: "en", region: "DE" } }),
    });
    const view = await section(en["settings.assistant.title"]);
    expect(await view.findByText(en["assistant.note.default"])).toBeVisible();
    expect(view.getByText(en["assistant.note.custom"])).toBeVisible();
    const summary = (await view.findByText(en["assistant.usage"])).closest(
      "details",
    );
    if (summary === null) throw new Error("no usage card");
    summary.open = true;
    expect(
      await view.findByRole("img", {
        name: `${en["assistant.usage.meter.requests"]}: ${en[
          "assistant.usage.of"
        ]
          .replace("{count}", "80")
          .replace("{limit}", "100")}`,
      }),
    ).toBeVisible();
    expect(
      view.getByText(en["assistant.usage.chart.empty"].replace("{days}", "30")),
    ).toBeVisible();
  });

  it("charts the last 30 days and meters today against the daily limit", async () => {
    const daysQueries: string[] = [];
    await renderApp("/settings?section=assistant", {
      fetch: api([], { daysQueries, days: true }),
    });
    const view = await section();
    await openUsage(view);
    // Role queries over the chart's SVG take longer than the test timeout.
    const day = (await view.findByText("16/10/2026")).closest("tr");
    if (day === null) throw new Error("no row for the day");
    expect([...day.querySelectorAll("td")].map((c) => c.textContent)).toEqual([
      "45",
      "1",
      "900",
    ]);
    expect(daysQueries).toEqual(["?from=2026-09-18&to=2026-10-17"]);
    expect(
      view.getByLabelText(pt["assistant.usage.chart.requests"]),
    ).toBeInTheDocument();
    expect(
      view.getByLabelText(pt["assistant.usage.chart.tokens"]),
    ).toBeInTheDocument();
    // A8: the value over a meter when a limit is declared, and alone when none is.
    expect(
      view.getByRole("img", {
        name: `${pt["assistant.usage.meter.requests"]}: 80 de 100`,
      }),
    ).toBeVisible();
    expect(
      view.getByRole("img", {
        name: `${pt["assistant.usage.meter.tokens"]}: 1.200`,
      }),
    ).toBeVisible();
  });

  it("shows a refused key at its field and in the summary", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=assistant", {
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
    await renderApp("/settings?section=assistant", { fetch: api([]) });
    const view = await section();
    await rowAction(view, "Groq", pt["assistant.provider.models"]);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("qwen")).toBeVisible();
  });

  it("says a refused key when listing models", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api([], { models: () => problem(502, "provider_unauthorized") }),
    });
    const view = await section();
    await rowAction(view, "Groq", pt["assistant.provider.models"]);
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(pt["problem.provider_unauthorized"]),
    ).toBeVisible();
  });

  it.each([
    [
      "accepts the key",
      undefined,
      pt["assistant.key.ok"].replace("{count}", "2"),
    ],
    [
      "shows the provider refusing the key",
      () => problem(502, "provider_unauthorized"),
      pt["problem.provider_unauthorized"],
    ],
    [
      "shows a missing key",
      () => problem(409, "secret_key_missing"),
      pt["problem.secret_key_missing"],
    ],
  ])(
    "checks a provider key from its row and %s",
    async (_name, models, text) => {
      await renderApp("/settings?section=assistant", {
        fetch: api([], { models }),
      });
      const view = await section();
      const row = await rowAction(view, "Groq", pt["assistant.key.check"]);
      const result = await within(row).findByText(text);
      expect(result).toBeVisible();
      // The result sits in the body slot beside the name; a bare child of the
      // item draws at the root font size.
      expect(result.parentElement).toBe(
        within(row).getByText("Groq").parentElement,
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("checks a key in English with the models counted by locale", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api([], {
        me: { language: "en", region: "DE" },
        models: () =>
          json(200, {
            items: Array.from({ length: 1234 }, (_, i) => `m${String(i)}`),
          }),
      }),
    });
    const view = await section(en["settings.assistant.title"]);
    const row = await rowAction(view, "Groq", en["assistant.key.check"]);
    expect(
      await within(row).findByText(
        en["assistant.key.ok"].replace("{count}", "1.234"),
      ),
    ).toBeVisible();
  });

  it("restores a use's default chain with an empty list", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=assistant", { fetch: api(sent) });
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

  // A8: the closed line states today; the open card holds one row per provider and model.
  it("keeps the usage closed on a summary and opens on today's figures", async () => {
    await renderApp("/settings?section=assistant", { fetch: api([]) });
    const view = await section();
    const details = await openUsage(view);
    details.open = false;
    expect(
      view.getByText(
        pt["assistant.usage.summary.requests"].replace("{count}", "80"),
      ),
    ).toBeInTheDocument();
    expect(
      view.getByText(
        pt["assistant.usage.summary.near"].replace("{count}", "1"),
      ),
    ).toBeInTheDocument();
    expect(view.queryByText(/em pausa/)).toBeNull();
    details.open = true;
    const row = await usageRow(view, "gemini-3.5-flash-lite");
    expect(
      within(row).getByText(
        `aistudio · ${pt["assistant.usage.errors"].replace("{count}", "2")}`,
      ),
    ).toBeVisible();
    expect(within(row).getByText(pt["assistant.usage.near"])).toBeVisible();
    const unused = await usageRow(view, "openai/gpt-oss-120b");
    expect(
      within(unused).getByText(pt["assistant.usage.unlimited"]),
    ).toBeVisible();
    // The figures of the period moved to the limits of the model.
    await userEvent.click(
      within(row).getByRole("button", { name: pt["assistant.usage.limits"] }),
    );
    expect(
      await within(await screen.findByRole("dialog")).findByText(
        "Últimos 30 dias: 300 requisições, 9.000 tokens",
      ),
    ).toBeVisible();
  });

  it("sends the declared limits", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=assistant", { fetch: api(sent) });
    const view = await section();
    await openUsage(view);
    const row = await usageRow(view, "openai/gpt-oss-120b");
    await userEvent.click(
      within(row).getByRole("button", { name: pt["assistant.usage.limits"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("spinbutton", {
        name: optionalName(pt["assistant.limits.requests"], "opcional"),
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

  // A1: the block "Advanced" is gone; the functions always show and only the usage folds.
  it("shows the functions with one provider and default chains", async () => {
    await renderApp("/settings?section=assistant", {
      fetch: api([], { uses: [defaultSuggest] }),
    });
    const view = await section();
    expect(
      await view.findByRole("heading", { name: pt["assistant.uses"] }),
    ).toBeVisible();
    expect(view.queryByRole("button", { name: "Avançado" })).toBeNull();
    expect(
      (await view.findByText(pt["assistant.usage"])).closest("details"),
    ).not.toHaveAttribute("open");
  });

  // A9, A11: the dialog of a default use lists the chain it runs and saves it as the default.
  it("lists the chain of a default use and saves it untouched as the default", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=assistant", { fetch: api(sent) });
    const view = await section();
    await userEvent.click(
      within(await useRow(view, pt["assistant.use.capture.suggest"])).getByRole(
        "button",
        { name: pt["assistant.use.edit"] },
      ),
    );
    const dialog = within(await screen.findByRole("dialog"));
    const order = within(
      dialog.getByRole("list", {
        name: pt["assistant.chain.title"].replace(
          "{use}",
          pt["assistant.use.capture.suggest"],
        ),
      }),
    );
    expect(order.getByText("gemini-3.5-flash-lite")).toBeVisible();
    expect(order.getAllByText("aistudio")[0]).toBeInTheDocument();
    await userEvent.click(
      dialog.getByRole("button", { name: pt["assistant.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "PUT /suggest-chain", body: { targets: [] } },
      ]);
    });
  });

  // A10: a model typed in the combobox and its capabilities marked in the checkboxes.
  it("adds a model with the capabilities marked", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=assistant", { fetch: api(sent) });
    const view = await section();
    await userEvent.click(
      within(await useRow(view, pt["assistant.use.assistant.chat"])).getByRole(
        "button",
        { name: pt["assistant.use.edit"] },
      ),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(
      dialog.getByRole("combobox", { name: pt["assistant.chain.model"] }),
      "llama",
    );
    await userEvent.click(
      dialog.getByRole("checkbox", {
        name: pt["assistant.capability.image_input"],
      }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: pt["assistant.chain.add"] }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: pt["assistant.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "PUT /chain",
          body: {
            targets: [
              {
                provider_id: "p1",
                model: "openai/gpt-oss-120b",
                capabilities: ["tools"],
              },
              {
                provider_id: "p1",
                model: "llama",
                capabilities: ["tools", "image_input"],
              },
            ],
          },
        },
      ]);
    });
  });
});
