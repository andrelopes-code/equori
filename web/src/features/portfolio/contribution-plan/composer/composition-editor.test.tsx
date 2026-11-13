import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

import { CompositionEditor } from "@/features/portfolio/contribution-plan/composer/composition-editor";
import type { CompositionEditorProps } from "@/features/portfolio/contribution-plan/composer/composition-editor";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";

const groups: CompositionGroup[] = [
  {
    key: "a",
    name: "Renda fixa",
    colour: 0,
    targetBp: 4000,
    todayBp: 3500,
    locked: false,
    amount: { amount: 150000, currency: "BRL" },
  },
  {
    key: "b",
    name: "Ações",
    colour: 1,
    targetBp: 2500,
    todayBp: 3000,
    locked: false,
    amount: { amount: 50000, currency: "BRL" },
  },
  {
    key: "c",
    name: "FIIs",
    colour: 2,
    targetBp: 2000,
    todayBp: 2000,
    locked: true,
  },
  {
    key: "d",
    name: "Exterior",
    colour: 3,
    targetBp: 1500,
    todayBp: 1500,
    locked: false,
  },
];

beforeEach(() => {
  // jsdom does not implement pointer capture.
  HTMLElement.prototype.setPointerCapture = () => undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CompositionEditor handles", () => {
  it("names each boundary and states both shares", () => {
    renderEditor();

    const handle = screen.getByRole("slider", {
      name: "Boundary between Renda fixa and Ações",
    });

    expect(handle).toHaveAttribute(
      "aria-valuetext",
      "Renda fixa 40%, Ações 25%",
    );
    expect(handle).toHaveAttribute("aria-valuenow", "4000");
    expect(handle).toHaveAttribute("aria-valuemin", "0");
    expect(handle).toHaveAttribute("aria-valuemax", "6500");
    expect(screen.getAllByRole("slider")).toHaveLength(3);
  });

  it.each([
    { name: "ArrowRight", key: "ArrowRight", shift: false, want: [4100, 2400] },
    { name: "ArrowUp", key: "ArrowUp", shift: false, want: [4100, 2400] },
    { name: "ArrowLeft", key: "ArrowLeft", shift: false, want: [3900, 2600] },
    { name: "ArrowDown", key: "ArrowDown", shift: false, want: [3900, 2600] },
    {
      name: "Shift+ArrowRight",
      key: "ArrowRight",
      shift: true,
      want: [4500, 2000],
    },
    {
      name: "Shift+ArrowLeft",
      key: "ArrowLeft",
      shift: true,
      want: [3500, 3000],
    },
    { name: "Home", key: "Home", shift: false, want: [0, 6500] },
    { name: "End", key: "End", shift: false, want: [6500, 0] },
  ])("$name moves the two neighbours", ({ key, shift, want }) => {
    const onTargets = vi.fn();
    renderEditor({ onTargets });

    fireEvent.keyDown(firstHandle(), { key, shiftKey: shift });

    expect(onTargets).toHaveBeenCalledExactlyOnceWith([...want, 2000, 1500]);
  });

  it("disables a handle next to a locked group", () => {
    const onTargets = vi.fn();
    renderEditor({ onTargets });

    fireEvent.keyDown(handleAt(1), { key: "ArrowRight" });
    fireEvent.keyDown(handleAt(2), { key: "ArrowLeft" });

    expect(firstHandle()).not.toHaveAttribute("aria-disabled");
    expect(handleAt(1)).toHaveAttribute("aria-disabled", "true");
    expect(handleAt(2)).toHaveAttribute("aria-disabled", "true");
    expect(onTargets).not.toHaveBeenCalled();
  });

  it("moves the boundary by the dragged distance", () => {
    mockWidths({ bar: 1000, full: 0, short: 0 });
    const onTargets = vi.fn();
    renderEditor({ onTargets });

    const handle = firstHandle();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 450 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 450 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600 });

    expect(onTargets).toHaveBeenCalledExactlyOnceWith([4500, 2000, 2000, 1500]);
  });
});

describe("CompositionEditor segment labels", () => {
  it("writes name and percent where they fit, the percent where only it fits", () => {
    mockWidths({ bar: 1000, full: 200, short: 40 });
    renderEditor();

    expect(rooms()).toEqual(["Renda fixa 40%", "Ações 25%", "20%", "15%"]);
  });

  it("writes nothing where the percent does not fit", () => {
    mockWidths({ bar: 300, full: 200, short: 40 });
    renderEditor();

    expect(rooms()).toEqual(["40%", "25%", "20%", ""]);
  });

  it("writes nothing in a segment at 0", () => {
    mockWidths({ bar: 1000, full: 200, short: 40 });
    renderEditor({
      groups: [
        { ...groups[0], targetBp: 10000 } as CompositionGroup,
        { ...groups[1], targetBp: 0 } as CompositionGroup,
      ],
    });

    expect(rooms()).toEqual(["Renda fixa 100%", ""]);
  });
});

describe("CompositionEditor contribution bar", () => {
  it("draws the split of the groups that receive money", () => {
    renderEditor();

    expect(contributionBar()).toBeVisible();
    expect(screen.queryByText("type the contribution")).toBeNull();
    expect(screen.queryByText("name every group")).toBeNull();
    expect(
      document.querySelectorAll("[data-bar=contribution] [data-segment]"),
    ).toHaveLength(2);
  });

  it("draws a muted track that asks for the amount", () => {
    renderEditor({ state: "noAmount" });

    expect(screen.getByText("type the contribution")).toBeVisible();
    expect(
      document.querySelectorAll("[data-bar=contribution] [data-segment]"),
    ).toHaveLength(0);
  });

  it("draws a muted track that asks for a name", () => {
    renderEditor({ state: "nameMissing" });

    expect(screen.getByText("name every group")).toBeVisible();
    expect(screen.queryByText("type the contribution")).toBeNull();
  });

  it("keeps the previous split while the preview is pending", () => {
    renderWithProviders(<PendingProbe />, { fetch: fakeApi({}) });
    const before = contributionBar().getAttribute("aria-label");

    fireEvent.click(screen.getByRole("button", { name: "pending" }));
    expect(contributionBar()).toHaveAttribute("aria-label", before ?? "");

    fireEvent.click(screen.getByRole("button", { name: "ready" }));
    expect(contributionBar()).not.toHaveAttribute("aria-label", before ?? "");
  });
});

function renderEditor(props: Partial<CompositionEditorProps> = {}) {
  renderWithProviders(editor(props), { fetch: fakeApi({}) });
}

// Changes the amounts, then marks the preview pending or ready, as the parent does.
function PendingProbe() {
  const [amount, setAmount] = useState(150000);
  const [pending, setPending] = useState(false);
  const next = groups.map((g) =>
    g.amount === undefined ? g : { ...g, amount: { ...g.amount, amount } },
  );

  return (
    <>
      <button
        onClick={() => {
          setAmount(9);
          setPending(true);
        }}
      >
        pending
      </button>
      <button
        onClick={() => {
          setPending(false);
        }}
      >
        ready
      </button>
      {editor({ groups: next, pending })}
    </>
  );
}

function editor(props: Partial<CompositionEditorProps>) {
  return (
    <CompositionEditor
      groups={groups}
      pending={false}
      state="ok"
      onTargets={() => undefined}
      {...props}
    />
  );
}

function firstHandle(): HTMLElement {
  return handleAt(0);
}

function handleAt(index: number): HTMLElement {
  const handle = screen.getAllByRole("slider")[index];
  if (handle === undefined) throw new Error(`no handle at ${String(index)}`);

  return handle;
}

function contributionBar(): HTMLElement {
  return screen.getByRole("img", { name: /^This contribution/ });
}

function rooms(): string[] {
  return [
    ...document.querySelectorAll("[data-bar=ideal] [data-measure=room]"),
  ].map((room) => room.textContent);
}

// jsdom lays nothing out: each measured element answers with the width the test sets. The room
// of a segment is its share of the bar minus the 16 px of padding.
function mockWidths(widths: { bar: number; full: number; short: number }) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return { width: measure(this, widths) } as DOMRect;
    },
  );
}

function measure(
  element: HTMLElement,
  widths: { bar: number; full: number; short: number },
): number {
  switch (element.dataset.measure) {
    case "bar":
      return widths.bar;
    case "full":
      return widths.full;
    case "short":
      return widths.short;
    case "room": {
      const grow = Number(
        element.closest<HTMLElement>("[data-segment]")?.style.flexGrow,
      );

      return (grow / 10000) * widths.bar - 16;
    }
    default:
      return 0;
  }
}
