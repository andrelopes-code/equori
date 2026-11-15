import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { MessageItem } from "@/features/assistant/message/message-item";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

type Proposal = components["schemas"]["AssistantProposal"];

const pending: Proposal = {
  id: "p1",
  tool: "record_transaction",
  status: "pending",
  suggested: false,
  waiting_for: [],
  preview: {
    action: "record_transaction",
    target: "Checking",
    changes: [
      {
        field: "amount",
        before: { amount: "10.00", currency: "BRL" },
        after: { amount: "1234.56", currency: "BRL" },
      },
      { field: "description", after: { text: "Lunch" } },
    ],
  },
  created_at: "2026-10-23T10:00:00Z",
  expires_at: "2099-10-23T10:15:00Z",
};

const leaks = ["1234.56", "1.234,56", "1,234.56"];

const confirmPath = (id: string) =>
  `POST /api/v1/assistant/proposals/${id}/confirm`;

const rejectPath = (id: string) =>
  `POST /api/v1/assistant/proposals/${id}/reject`;

// Spec 2026-11-15 section 4: the proposals of one answer form one decision sheet.
describe("DecisionSheet", () => {
  // Spec 2026-11-15 section 4 (Operation row, Body).
  it("shows the action, the target and each change", () => {
    renderAnswer([pending], fakeApi({}));

    expect(screen.getByText("Record transaction")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText(/1[.,]234[.,]56/)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Record transaction" }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Confirm 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  // P17 amended, spec 2026-11-15 section 4 (Confirm).
  it("confirms the marked proposals in order and stops at the first failure", async () => {
    const order: string[] = [];
    const answer = (id: string) => async () => {
      order.push(id);
      await Promise.resolve();

      return id === "p2"
        ? problem(409, "proposal_stale")
        : json(200, { ...pending, id, status: "executed" });
    };
    renderAnswer(
      three(),
      fakeApi({
        [confirmPath("p1")]: answer("p1"),
        [confirmPath("p2")]: answer("p2"),
        [confirmPath("p3")]: answer("p3"),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm 3" }));
    await waitFor(() => {
      expect(order).toEqual(["p1", "p2"]);
    });

    expect(
      await screen.findByText(catalogEn["assistant.proposal.status.executed"]),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(order).toEqual(["p1", "p2"]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Confirm 2" })).toBeEnabled();
  });

  // Review of phase 4, spec 2026-11-15 section 4 (Confirm): a tool that fails answers 200 with
  // status failed; the run stops there.
  it("stops the confirm at a proposal whose tool failed", async () => {
    const order: string[] = [];
    const answer = (id: string) => () => {
      order.push(id);

      return json(200, {
        ...pending,
        id,
        status: id === "p2" ? "failed" : "executed",
        result: id === "p2" ? { code: "x", detail: "the tool failed" } : {},
      });
    };
    renderAnswer(
      three(),
      fakeApi({
        [confirmPath("p1")]: answer("p1"),
        [confirmPath("p2")]: answer("p2"),
        [confirmPath("p3")]: answer("p3"),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm 3" }));

    expect(
      await screen.findByText(
        `${catalogEn["assistant.result.not_applied"]} the tool failed`,
      ),
    ).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(order).toEqual(["p1", "p2"]);
  });

  // Spec 2026-11-15 section 4 (Default marks, Confirm).
  it("confirms only what is marked", async () => {
    const order: string[] = [];
    const answer = (id: string) => () => {
      order.push(id);

      return json(200, { ...pending, id, status: "executed" });
    };
    renderAnswer(
      [pending, { ...pending, id: "p2" }],
      fakeApi({
        [confirmPath("p1")]: answer("p1"),
        [confirmPath("p2")]: answer("p2"),
      }),
    );

    const [, second] = screen.getAllByRole("checkbox");
    if (second === undefined) throw new Error("two rows");

    await userEvent.click(second);
    await userEvent.click(screen.getByRole("button", { name: "Confirm 1" }));

    expect(
      await screen.findByText(catalogEn["assistant.proposal.status.executed"]),
    ).toBeInTheDocument();
    expect(order).toEqual(["p1"]);
    expect(screen.getByText("0 of 1 marked")).toBeInTheDocument();
  });

  // Spec 2026-11-15 section 4 (Default marks, Footer): the one-proposal case of "offers no confirm
  // all".
  it("offers one confirm for one pending proposal", () => {
    renderAnswer([pending], fakeApi({}));

    expect(
      screen.queryByRole("button", {
        name: catalogEn["assistant.proposal.confirm_all"],
      }),
    ).toBeNull();
    expect(
      screen.getByText(catalogEn["assistant.sheet.all"]),
    ).toBeInTheDocument();
  });

  // Spec 2026-11-15 section 4 (Default marks, Footer).
  it("starts a destructive proposal unmarked and turns the confirm danger when marked", async () => {
    renderAnswer(
      [
        {
          ...pending,
          preview: { ...pending.preview, destructive: true },
        },
      ],
      fakeApi({}),
    );

    expect(
      screen.getByText(catalogEn["assistant.sheet.irreversible_tag"]),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm 0" })).toBeDisabled();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Record transaction" }),
    );

    expect(screen.getByRole("button", { name: "Confirm 1" })).toHaveAttribute(
      "data-tone",
      "danger",
    );
    expect(screen.getByText("Includes 1 irreversible")).toBeInTheDocument();
  });

  // Spec 2026-11-15 section 4 (Dependent, Confirm).
  it("confirms a dependent right after its parent", async () => {
    const order: string[] = [];
    const answer = (id: string) => () => {
      order.push(id);

      return json(200, { ...pending, id, status: "executed" });
    };
    renderAnswer(
      [
        pending,
        { ...pending, id: "p3", status: "waiting", waiting_for: ["p1"] },
      ],
      fakeApi({
        [confirmPath("p1")]: answer("p1"),
        [confirmPath("p3")]: answer("p3"),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm 1" }));

    await waitFor(() => {
      expect(order).toEqual(["p1", "p3"]);
    });
  });

  // Spec 2026-11-15 section 4 (Reject).
  it("rejects the marked proposals in order", async () => {
    const order: string[] = [];
    const answer = (id: string) => () => {
      order.push(id);

      return json(200, { ...pending, id, status: "rejected" });
    };
    renderAnswer(
      [pending, { ...pending, id: "p2" }],
      fakeApi({
        [rejectPath("p1")]: answer("p1"),
        [rejectPath("p2")]: answer("p2"),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(order).toEqual(["p1", "p2"]);
    });
  });

  // Spec 2026-11-15 section 4 (Header).
  it("shows the deadline once", () => {
    renderAnswer(
      [
        { ...pending, expires_at: "2099-10-23T10:30:00Z" },
        { ...pending, id: "p2", expires_at: "2099-10-23T10:20:00Z" },
      ],
      fakeApi({}),
    );

    const time = new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date("2099-10-23T10:20:00Z"));

    expect(screen.getAllByText(/^until /)).toHaveLength(1);
    expect(screen.getByText(`until ${time}`)).toBeInTheDocument();
    expect(screen.getByText("2 changes to review")).toBeInTheDocument();
  });

  // P15 kept, spec 2026-11-15 section 4 (Confirm): a row turns expired at its instant.
  it("expires a row without a click (P15)", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));

    try {
      renderAnswer(
        [
          { ...pending, expires_at: "2026-10-23T10:05:00Z" },
          { ...pending, id: "p2" },
        ],
        fakeApi({}),
      );

      expect(screen.getAllByRole("checkbox")).toHaveLength(2);

      act(() => {
        vi.advanceTimersByTime(5 * 60_000);
      });

      expect(screen.getAllByRole("checkbox")).toHaveLength(1);
      expect(
        screen.getByText(catalogEn["assistant.proposal.status.expired"]),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm 1" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  // Spec 2026-11-15 section 4 (Dependent).
  it("draws a waiting proposal under its parent", () => {
    renderAnswer(
      [
        pending,
        {
          ...pending,
          id: "p3",
          status: "waiting",
          waiting_for: ["p1"],
          preview: { ...pending.preview, action: "manage_schedule.create" },
        },
      ],
      fakeApi({}),
    );

    const dependent = screen.getByRole("checkbox", { name: "Create schedule" });

    expect(dependent).toBeDisabled();
    expect(dependent).toBeChecked();
    expect(
      screen.getByText(catalogEn["assistant.sheet.next"]),
    ).toBeInTheDocument();
  });

  // Spec 2026-11-15 section 4 (Dependent): a waiting proposal whose parent is no longer open.
  it("shows an orphan waiting row with its summary and its parent", () => {
    const parent: Proposal = { ...pending, id: "p0", status: "executed" };

    renderAnswer(
      [
        parent,
        {
          ...pending,
          id: "p2",
          status: "waiting",
          summary: "Create the subscription",
          waiting_for: ["p0"],
          preview: { ...pending.preview, action: "manage_schedule.create" },
        },
      ],
      fakeApi({}),
    );

    expect(screen.getByText("Create the subscription")).toBeInTheDocument();
    expect(
      screen.getByText("Waits for the confirmation of: Record transaction"),
    ).toBeInTheDocument();

    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).toBeDisabled();
    }
  });

  // Spec 2026-11-15 section 4 (Privacy).
  it("writes no amount while privacy is on", () => {
    hideAmounts();
    const { container } = renderAnswer([pending], fakeApi({}));

    expect(within(container).getByRole("checkbox")).toBeInTheDocument();
    expect(within(container).getByText("Lunch")).toBeInTheDocument();
    expectNoAmounts(container, leaks);
  });

  // Spec 2026-11-15 section 4 (Operation row, Body).
  it("labels a suggested proposal and gives its reason", () => {
    renderAnswer(
      [{ ...pending, suggested: true, reason: "Repeats monthly" }],
      fakeApi({}),
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(
      screen.getByText(catalogEn["assistant.proposal.suggested"]),
    ).toBeInTheDocument();
    expect(screen.getByText("Repeats monthly")).toBeInTheDocument();
  });

  // Review of phase 4, spec 2026-11-15 section 4 (Confirm): rows lock while a confirm runs.
  it("locks the rows while a confirm runs", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const answer = (id: string) => async () => {
      order.push(id);
      if (id === "p2") await gate;

      return json(200, { ...pending, id, status: "executed" });
    };
    renderAnswer(
      three(),
      fakeApi({
        [confirmPath("p1")]: answer("p1"),
        [confirmPath("p2")]: answer("p2"),
        [confirmPath("p3")]: answer("p3"),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm 3" }));
    await waitFor(() => {
      expect(order).toEqual(["p1", "p2"]);
    });

    for (const box of screen.getAllByRole("checkbox"))
      expect(box).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(
      screen.getByText(catalogEn["assistant.proposal.status.executing"]),
    ).toBeInTheDocument();

    release();

    await waitFor(() => {
      expect(order).toEqual(["p1", "p2", "p3"]);
    });
  });
});

function three(): Proposal[] {
  return ["p1", "p2", "p3"].map((id) => ({ ...pending, id }));
}

function renderAnswer(proposals: Proposal[], fetch: typeof globalThis.fetch) {
  return renderWithProviders(
    <MessageItem
      message={{
        id: "m2",
        role: "assistant",
        content: "Changes.",
        outcome: "answered",
        created_at: "2026-10-23T10:00:01Z",
        proposals,
      }}
    />,
    { fetch },
  );
}
