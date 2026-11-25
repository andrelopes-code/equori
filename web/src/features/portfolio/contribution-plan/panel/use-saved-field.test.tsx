import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSavedField } from "@/features/portfolio/contribution-plan/panel/use-saved-field";

function Probe({
  saved,
  onSave,
}: {
  saved: string;
  onSave: (value: string) => boolean;
}) {
  const field = useSavedField(saved, onSave);

  return (
    <input
      aria-label="field"
      value={field.value}
      onChange={(event) => {
        field.onChange(event.currentTarget.value);
      }}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
    />
  );
}

const field = () => screen.getByRole("textbox", { name: "field" });
const type = (value: string) => {
  fireEvent.change(field(), { target: { value } });
};

describe("useSavedField", () => {
  it("saves on blur, and the typed value stays until it is saved", () => {
    const onSave = vi.fn(() => true);
    const { rerender } = render(<Probe saved="a" onSave={onSave} />);

    type("b");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(field());

    expect(onSave).toHaveBeenCalledExactlyOnceWith("b");
    expect(field()).toHaveValue("b");

    rerender(<Probe saved="b" onSave={onSave} />);
    expect(field()).toHaveValue("b");

    rerender(<Probe saved="c" onSave={onSave} />);
    expect(field()).toHaveValue("c");
  });

  it("saves on Enter and breaks the line on Shift+Enter", () => {
    const onSave = vi.fn(() => true);
    render(<Probe saved="a" onSave={onSave} />);

    type("b");
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSave).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("goes back on Escape, which does not reach what is around it", () => {
    const onSave = vi.fn(() => true);
    render(<Probe saved="a" onSave={onSave} />);

    expect(fireEvent.keyDown(field(), { key: "Escape" })).toBe(true);
    type("b");
    expect(fireEvent.keyDown(field(), { key: "Escape" })).toBe(false);

    expect(field()).toHaveValue("a");
    fireEvent.blur(field());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("goes back when the value is refused", () => {
    render(<Probe saved="a" onSave={() => false} />);

    type("");
    fireEvent.blur(field());

    expect(field()).toHaveValue("a");
  });
});
