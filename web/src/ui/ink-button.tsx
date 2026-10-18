import type { ButtonHTMLAttributes } from "react";

import styles from "@/ui/ink-button.module.css";

// Families read: button. Its solid variant paints the accent tone, which the ledger keeps for
// what is forecast; the entry's one primary action is drawn in ink, the inverse surface
// (shell second pass S2, complete frontend F2).
export function InkButton({
  size = "md",
  block = false,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "md" | "lg";
  // Fills the inline size of its container, as the phone's entry does.
  block?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      data-own="ink-button"
      data-size={size}
      {...(block ? { "data-block": "" } : {})}
      className={[styles.ink, className].filter(Boolean).join(" ")}
    />
  );
}
