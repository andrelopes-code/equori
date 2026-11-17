import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/testing/render-app";
import type { CardFaceProps } from "@/ui/card-face/card-face";
import { CardFaceStudio } from "@/ui/card-face/studio/card-face-studio";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";
import { emptyFace } from "@/ui/card-face/studio/face-draft";

interface HostProps {
  initial?: FaceDraft | undefined;
  spy: (next: FaceDraft) => void;
}

const preview: CardFaceProps = {
  title: "Nubank Ultravioleta",
  holder: "Ana Souza",
  lastFour: "4821",
};

function Host({ initial = emptyFace, spy }: HostProps) {
  const [draft, setDraft] = useState(initial);

  return (
    <CardFaceStudio
      value={draft}
      onChange={(next) => {
        spy(next);
        setDraft(next);
      }}
      suggested="#820ad1"
      preview={preview}
    />
  );
}

function studio(initial?: FaceDraft) {
  const spy = vi.fn<(next: FaceDraft) => void>();

  renderWithProviders(<Host initial={initial} spy={spy} />, {
    fetch: vi.fn<typeof fetch>(),
  });

  return spy;
}

function option(name: string, group: string) {
  return within(screen.getByRole("radiogroup", { name: group })).getByRole(
    "radio",
    {
      name,
    },
  );
}

describe("CardFaceStudio", () => {
  it("sets a preset colour and shows the dark ink on a light colour", () => {
    const spy = studio();

    fireEvent.click(option("Yellow", "Colour"));

    expect(spy).toHaveBeenLastCalledWith({ ...emptyFace, color: "#fce300" });
    expect(screen.getByText("Dark")).toBeTruthy();
  });

  it("sets the colour from a typed hexadecimal in any case", () => {
    const spy = studio();

    fireEvent.change(screen.getByRole("textbox", { name: "Hexadecimal" }), {
      target: { value: "#0B4EA2" },
    });

    expect(spy).toHaveBeenLastCalledWith({ ...emptyFace, color: "#0b4ea2" });
  });

  it("shows the error for an invalid hexadecimal and keeps the colour", () => {
    const spy = studio({ ...emptyFace, color: "#fce300" });

    fireEvent.change(screen.getByRole("textbox", { name: "Hexadecimal" }), {
      target: { value: "#12" },
    });

    expect(
      screen.getByText(
        "Invalid colour. Use the format #RRGGBB, for example #820AD1.",
      ),
    ).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText("Dark")).toBeTruthy();
  });

  it("sets the art", () => {
    const spy = studio();

    fireEvent.click(option("Waves", "Art"));

    expect(spy).toHaveBeenLastCalledWith({ ...emptyFace, art: "waves" });
  });

  it("sets the chip, the orientation and the brand", () => {
    const spy = studio();

    fireEvent.click(option("Silver", "Chip"));
    fireEvent.click(option("Vertical", "Orientation"));
    fireEvent.click(option("None", "Issuer's brand"));

    expect(spy).toHaveBeenLastCalledWith({
      ...emptyFace,
      chip: "silver",
      orientation: "vertical",
      brand: "none",
    });
  });

  it("restores the suggestion and disables the button when it applies", () => {
    const spy = studio({ ...emptyFace, color: "#fce300" });
    const restore = screen.getByRole("button", {
      name: "Restore the suggestion",
    });

    fireEvent.click(restore);

    expect(spy).toHaveBeenLastCalledWith({ ...emptyFace, color: null });
    expect(restore.hasAttribute("disabled")).toBe(true);
  });

  it("marks a contrast of 4.5 or more with AA", () => {
    studio({ ...emptyFace, color: "#820ad1" });

    expect(screen.getByText("AA")).toBeTruthy();
  });
});
