import { useRef } from "react";
import type { CSSProperties, MouseEvent } from "react";

import { CalculatorBar } from "@/app/shell/calculator/calculator-bar";
import { CalculatorDisplay } from "@/app/shell/calculator/calculator-display";
import { CalculatorKeys } from "@/app/shell/calculator/calculator-keys";
import styles from "@/app/shell/calculator/calculator.module.css";
import { useAccount } from "@/app/shell/calculator/use-account";
import { useOpenFocus } from "@/app/shell/calculator/use-open-focus";
import { useWindowDrag } from "@/app/shell/calculator/use-window-drag";
import type { Place } from "@/app/shell/calculator/window-place";
import { useT } from "@/i18n/i18n-provider";

interface CalculatorWindowProps {
  open: boolean;
  onClose: () => void;
}

// The floating calculator (docs/specs/2026-11-17-floating-calculator-design.md): a window above
// the page that holds nobody. An element of the application's own; the families read and what
// each lacks: Dialog (modal={false}) centres its panel and has no handle to move it; Popover is
// anchored to its trigger and closes on an outside press; Drawer and DetailPanel are fixed to
// an edge.
// Workaround for Slotted issue #132: no family draws a non-modal panel the reader drags.
export function CalculatorWindow({ open, onClose }: CalculatorWindowProps) {
  const t = useT();
  // Both live while the window is closed, so the account and the place are kept (K5).
  const field = useRef<HTMLInputElement>(null);
  const account = useAccount(field);
  const frame = useRef<HTMLElement>(null);
  const drag = useWindowDrag(frame);
  useOpenFocus(open, field);

  // K21: a press on a key, on a button or on the window's ground leaves the focus, and so the
  // caret and the selection, on the account.
  function handleMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.target === field.current) return;

    event.preventDefault();
    field.current?.focus();
  }

  if (!open) return null;

  return (
    <section
      ref={frame}
      className={styles.window}
      data-part="window"
      data-placed={drag.place === null ? undefined : ""}
      aria-label={t("calculator.title")}
      style={placeStyle(drag.place)}
      onMouseDown={handleMouseDown}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <CalculatorBar drag={drag} onClose={onClose} />

      <CalculatorDisplay account={account} field={field} />

      <CalculatorKeys
        decimal={account.separators.decimal}
        onPress={account.press}
      />
    </section>
  );
}

// The moved place, as the two lengths the stylesheet holds inside the visible area.
function placeStyle(place: Place | null): CSSProperties | undefined {
  if (place === null) return undefined;

  return {
    "--calculator-x": `${String(place.x)}px`,
    "--calculator-y": `${String(place.y)}px`,
  } as CSSProperties;
}
