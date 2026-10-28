import { Glyph } from "@slotted/react/icon";

// The glyph of a previous or next step, drawn inside an Icon.
export function StepGlyph({ direction }: { direction: "previous" | "next" }) {
  return (
    <Glyph name={direction === "previous" ? "chevron-left" : "chevron-right"} />
  );
}
