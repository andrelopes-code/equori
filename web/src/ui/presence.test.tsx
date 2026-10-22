import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Presence } from "@/ui/presence";
import { useOverlayOpen } from "@/ui/use-overlay-open";

const seen: string[] = [];

function Probe({ name }: { name: string }) {
  const open = useOverlayOpen();
  const [typed] = useState(() => `fresh ${name}`);
  seen.push(`${name}:${String(open)}`);
  return <p data-open={String(open)}>{typed}</p>;
}

function host(value: string | undefined) {
  return <Presence value={value}>{(name) => <Probe name={name} />}</Presence>;
}

describe("Presence", () => {
  it("renders the overlay closed first, then open, so it plays its enter", () => {
    seen.length = 0;
    const { rerender } = render(host(undefined));
    rerender(host("plan"));
    expect(seen[0]).toBe("plan:false");
    expect(seen.at(-1)).toBe("plan:true");
  });

  it("keeps the last value on screen, closed, while it leaves", () => {
    const { rerender } = render(host("plan"));
    rerender(host(undefined));
    const shown = screen.getByText("fresh plan");
    expect(shown).toHaveAttribute("data-open", "false");
  });

  it("starts each opening with fresh state", () => {
    const { rerender } = render(host("first"));
    rerender(host(undefined));
    act(() => {
      rerender(host("second"));
    });
    expect(screen.getByText("fresh second")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("reads open outside a presence", () => {
    render(<Probe name="alone" />);
    expect(screen.getByText("fresh alone")).toHaveAttribute(
      "data-open",
      "true",
    );
  });
});
