import type { ReactNode } from "react";

// A catalogue sentence with a node, such as a figure, in place of one placeholder; the
// sentence stays in the catalogue (O6) while the value keeps its own markup.
export function withValue(
  template: string,
  slot: string,
  value: ReactNode,
): ReactNode {
  const at = template.indexOf(slot);
  if (at < 0) return template;
  return (
    <>
      {template.slice(0, at)}
      {value}
      {template.slice(at + slot.length)}
    </>
  );
}
