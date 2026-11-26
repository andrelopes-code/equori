import { Tag } from "@slotted/react/tag";
import type { ComponentProps } from "react";

type TitleTagProps = Omit<ComponentProps<typeof Tag>, "size" | "inline">;

// A tag beside a title or a text: it is drawn inside the line and adds nothing to its height (O22).
export function TitleTag(props: TitleTagProps) {
  return <Tag {...props} size="sm" inline />;
}
