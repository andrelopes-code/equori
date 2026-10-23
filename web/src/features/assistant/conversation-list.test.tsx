import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConversationList } from "@/features/assistant/conversation-list";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const items = [
  {
    id: "c1",
    title: "Older question",
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
  },
  {
    id: "c2",
    title: "Newer question",
    created_at: "2026-10-22T10:00:00Z",
    updated_at: "2026-10-22T10:00:00Z",
  },
];

function api(deleted: string[]) {
  return fakeApi({
    "GET /api/v1/assistant/conversations": () => json(200, { items }),
    "DELETE /api/v1/assistant/conversations/c2": () => {
      deleted.push("c2");
      return new Response(null, { status: 204 });
    },
    "DELETE /api/v1/assistant/conversations": () => {
      deleted.push("all");
      return new Response(null, { status: 204 });
    },
  });
}

describe("ConversationList", () => {
  it("lists the newest first and opens one", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<ConversationList onOpen={onOpen} />, {
      fetch: api([]),
    });
    const rows = await screen.findAllByRole("listitem");
    expect(
      rows.map((r) => within(r).getByText(/question$/).textContent),
    ).toEqual(["Newer question", "Older question"]);
    await userEvent.click(
      screen.getByRole("button", { name: "Newer question" }),
    );
    expect(onOpen).toHaveBeenCalledWith("c2");
  });

  it("deletes one conversation", async () => {
    const deleted: string[] = [];
    renderWithProviders(<ConversationList onOpen={vi.fn()} />, {
      fetch: api(deleted),
    });
    const rows = await screen.findAllByRole("listitem");
    await userEvent.click(
      within(rows[0] ?? document.body).getByRole("button", {
        name: /Delete conversation/,
      }),
    );
    await waitFor(() => {
      expect(deleted).toEqual(["c2"]);
    });
  });

  it("asks before deleting all", async () => {
    const deleted: string[] = [];
    renderWithProviders(<ConversationList onOpen={vi.fn()} />, {
      fetch: api(deleted),
    });
    await screen.findAllByRole("listitem");
    await userEvent.click(
      screen.getByRole("button", { name: "Delete all conversations" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(deleted).toEqual([]);
    expect(
      within(dialog).getByText(
        "Delete every conversation and its pending proposals?",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete all conversations" }),
    );
    await waitFor(() => {
      expect(deleted).toEqual(["all"]);
    });
  });
});
