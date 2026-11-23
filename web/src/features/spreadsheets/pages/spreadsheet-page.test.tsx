import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

interface Opened {
  content: unknown;
  editable: boolean;
  onChange: () => void;
}

// The editor draws on a canvas and weighs megabytes; the page is tested against its contract.
const editor = vi.hoisted(() => ({
  opened: [] as Opened[],
  snapshot: { id: "on-screen" },
  disposed: 0,
}));

vi.mock("@/features/spreadsheets/editor/create-editor", () => ({
  createEditor: (options: Opened) => {
    editor.opened.push(options);
    return Promise.resolve({
      snapshot: () => editor.snapshot,
      activeSheet: () => ({
        name: "Sheet1",
        rows: [
          ["a", 1.5],
          [null, "x,y"],
        ],
      }),
      setDark: () => undefined,
      dispose: () => {
        editor.disposed += 1;
      },
    });
  },
}));

const downloads = vi.hoisted(() => [] as unknown[][]);

vi.mock("@/features/spreadsheets/files/download-file", () => ({
  downloadFile: (...args: unknown[]) => {
    downloads.push(args);
  },
}));

const id = "b0000000-0000-4000-8000-000000000001";
const copyID = "b0000000-0000-4000-8000-000000000002";

function document(version: number, name = "Budget", docID = id) {
  return {
    id: docID,
    name,
    version,
    created_at: "2026-11-20T12:00:00Z",
    updated_at: "2026-11-21T15:30:00Z",
    content: { id: `stored-${String(version)}` },
  };
}

interface Sent {
  route: string;
  body: unknown;
}

function api(sent: Sent[], opts: { role?: string; conflict?: boolean } = {}) {
  let stored = 3;
  const record =
    (route: string, answer: () => Response) => async (req: Request) => {
      const text = await req.text();
      sent.push({ route, body: text === "" ? null : JSON.parse(text) });
      return answer();
    };
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "member",
        language: "en",
        region: "DE",
        books_id: 1,
        book_role: opts.role ?? "write",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
    "GET /api/v1/spreadsheets": () => json(200, { items: [] }),
    [`GET /api/v1/spreadsheets/${id}`]: () => json(200, document(stored)),
    [`GET /api/v1/spreadsheets/${copyID}`]: () =>
      json(200, document(1, "Copy of Budget", copyID)),
    [`PUT /api/v1/spreadsheets/${id}`]: record("save", () => {
      if (opts.conflict === true) {
        stored = 9;
        return problem(409, "version_conflict");
      }
      stored += 1;
      return json(200, document(stored));
    }),
    "POST /api/v1/spreadsheets": record("create", () =>
      json(201, document(1, "Copy of Budget", copyID)),
    ),
  });
}

async function opened(count = 1): Promise<Opened> {
  await waitFor(() => {
    expect(editor.opened.length).toBeGreaterThanOrEqual(count);
  });
  await screen.findByRole("heading", { level: 1 });
  const last = editor.opened.at(-1);
  if (last === undefined) throw new Error("no editor");
  return last;
}

beforeEach(() => {
  localStorage.clear();
  editor.opened = [];
  editor.disposed = 0;
  downloads.length = 0;
});

describe("SpreadsheetPage", () => {
  it("opens the stored content and saves nothing by itself", async () => {
    const sent: Sent[] = [];
    await renderApp(`/spreadsheets/${id}`, { fetch: api(sent) });

    const open = await opened();

    expect(open.content).toEqual({ id: "stored-3" });
    expect(open.editable).toBe(true);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Budget",
    );
    expect(
      screen.getByText(catalogEn["spreadsheets.status.saved"]),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("saves the screen after a pause, each save with the version of the last", async () => {
    const sent: Sent[] = [];
    await renderApp(`/spreadsheets/${id}`, { fetch: api(sent) });
    const open = await opened();

    open.onChange();
    open.onChange();

    expect(
      await screen.findByText(catalogEn["spreadsheets.status.pending"]),
    ).toBeInTheDocument();
    await waitFor(
      () => {
        expect(sent).toEqual([
          { route: "save", body: { content: { id: "on-screen" }, version: 3 } },
        ]);
      },
      { timeout: 4000 },
    );
    await screen.findByText(catalogEn["spreadsheets.status.saved"]);

    open.onChange();
    await userEvent.keyboard("{Control>}s{/Control}");

    await waitFor(() => {
      expect(sent[1]).toEqual({
        route: "save",
        body: { content: { id: "on-screen" }, version: 4 },
      });
    });
  });

  it("saves a waiting change when the reader leaves the page", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp(`/spreadsheets/${id}`, {
      fetch: api(sent),
    });
    const open = await opened();

    open.onChange();
    await router.navigate({ to: "/spreadsheets" });

    await waitFor(() => {
      expect(sent).toEqual([
        { route: "save", body: { content: { id: "on-screen" }, version: 3 } },
      ]);
    });
  });

  it("stops saving after a conflict and opens the saved version on request", async () => {
    const sent: Sent[] = [];
    await renderApp(`/spreadsheets/${id}`, {
      fetch: api(sent, { conflict: true }),
    });
    const open = await opened();

    open.onChange();
    await userEvent.keyboard("{Control>}s{/Control}");
    await screen.findByText(catalogEn["spreadsheets.conflict.title"]);
    open.onChange();
    await userEvent.keyboard("{Control>}s{/Control}");

    expect(sent).toHaveLength(1);

    const before = editor.opened.length;
    await userEvent.click(
      screen.getByRole("button", {
        name: catalogEn["spreadsheets.conflict.reload"],
      }),
    );
    const again = await opened(before + 1);

    expect(again.content).toEqual({ id: "stored-9" });
    expect(
      screen.queryByText(catalogEn["spreadsheets.conflict.title"]),
    ).toBeNull();
  });

  it("keeps the screen of a conflict as a new spreadsheet", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp(`/spreadsheets/${id}`, {
      fetch: api(sent, { conflict: true }),
    });
    const open = await opened();

    open.onChange();
    await userEvent.keyboard("{Control>}s{/Control}");
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["spreadsheets.conflict.keep"],
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/spreadsheets/${copyID}`);
    });
    expect(sent[1]).toEqual({
      route: "create",
      body: { name: "Copy of Budget", content: { id: "on-screen" } },
    });
  });

  it("opens a reader's spreadsheet without edits and offers only the downloads", async () => {
    const sent: Sent[] = [];
    await renderApp(`/spreadsheets/${id}`, {
      fetch: api(sent, { role: "read" }),
    });

    const open = await opened();

    expect(open.editable).toBe(false);
    expect(
      screen.getByText(catalogEn["spreadsheets.status.readOnly"]),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["spreadsheets.more"] }),
    );

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual([
      catalogEn["spreadsheets.downloadXlsx"],
      catalogEn["spreadsheets.downloadCsv"],
    ]);
  });

  it("hands the sheet on screen as a CSV file named after the spreadsheet", async () => {
    await renderApp(`/spreadsheets/${id}`, { fetch: api([]) });
    await opened();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["spreadsheets.more"] }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", {
        name: catalogEn["spreadsheets.downloadCsv"],
      }),
    );

    await waitFor(() => {
      expect(downloads).toEqual([
        [
          "Budget - Sheet1",
          "csv",
          '\uFEFFa,1.5\r\n,"x,y"',
          "text/csv;charset=utf-8",
        ],
      ]);
    });
  });

  it("hands every sheet as an XLSX file", async () => {
    await renderApp(`/spreadsheets/${id}`, { fetch: api([]) });
    await opened();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["spreadsheets.more"] }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", {
        name: catalogEn["spreadsheets.downloadXlsx"],
      }),
    );

    await waitFor(() => {
      expect(downloads).toHaveLength(1);
    });
    const [name, extension, bytes] = downloads[0] ?? [];

    expect([name, extension]).toEqual(["Budget", "xlsx"]);
    // A ZIP archive starts with "PK".
    expect([...(bytes as Uint8Array).slice(0, 2)]).toEqual([0x50, 0x4b]);
  });

  it("states that a spreadsheet of another book does not exist", async () => {
    await renderApp("/spreadsheets/b0000000-0000-4000-8000-00000000dead", {
      fetch: api([]),
    });

    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(editor.opened).toEqual([]);
  });
});
