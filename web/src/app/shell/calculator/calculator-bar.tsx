import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";

import styles from "@/app/shell/calculator/calculator.module.css";
import type { WindowDrag } from "@/app/shell/calculator/use-window-drag";
import { useT } from "@/i18n/i18n-provider";

interface CalculatorBarProps {
  drag: WindowDrag;
  onClose: () => void;
}

// The bar is the handle of the drag; its grip takes the focus and the arrow keys (K8).
export function CalculatorBar({ drag, onClose }: CalculatorBarProps) {
  const t = useT();

  return (
    <div
      className={styles.bar}
      data-part="bar"
      data-dragging={drag.dragging || undefined}
      onPointerDown={drag.handlePointerDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      onPointerCancel={drag.handlePointerUp}
    >
      <button
        type="button"
        className={styles.grip}
        data-grip=""
        aria-label={t("calculator.move")}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
        onKeyDown={drag.handleKeyDown}
      >
        <Glyph name="grip-horizontal" />
      </button>
      <span className={styles.title}>{t("calculator.title")}</span>
      <IconButton
        size="sm"
        aria-label={t("calculator.close")}
        onClick={onClose}
      >
        <Icon size="sm">
          <Glyph name="x" />
        </Icon>
      </IconButton>
    </div>
  );
}
