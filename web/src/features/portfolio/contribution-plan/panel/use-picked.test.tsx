import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePicked } from "@/features/portfolio/contribution-plan/panel/use-picked";

function Probe({ saved, pending }: { saved: string; pending: boolean }) {
  const picked = usePicked(saved, pending);

  return (
    <button
      type="button"
      onClick={() => {
        picked.pick("b");
      }}
    >
      {picked.value}
    </button>
  );
}

const button = () => screen.getByRole("button");

describe("usePicked", () => {
  it("shows the choice at the press and while it is saved", () => {
    const { rerender } = render(<Probe saved="a" pending={false} />);

    fireEvent.click(button());
    expect(button()).toHaveTextContent("b");

    rerender(<Probe saved="a" pending />);
    expect(button()).toHaveTextContent("b");

    rerender(<Probe saved="b" pending={false} />);
    expect(button()).toHaveTextContent("b");
  });

  it("goes back to the saved value after a refused save", () => {
    const { rerender } = render(<Probe saved="a" pending={false} />);

    fireEvent.click(button());
    rerender(<Probe saved="a" pending />);
    rerender(<Probe saved="a" pending={false} />);

    expect(button()).toHaveTextContent("a");
  });

  it("does not keep an old choice over a newer saved value", () => {
    const { rerender } = render(<Probe saved="a" pending={false} />);

    fireEvent.click(button());
    rerender(<Probe saved="a" pending />);
    rerender(<Probe saved="b" pending={false} />);
    rerender(<Probe saved="c" pending />);

    expect(button()).toHaveTextContent("c");
  });
});
