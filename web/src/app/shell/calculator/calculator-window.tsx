import {
  FloatingPanel,
  FloatingPanelBody,
  FloatingPanelClose,
  FloatingPanelHandle,
  FloatingPanelTitle,
} from "@slotted/react/floating-panel";
import { useRef } from "react";
import type { MouseEvent } from "react";

import { CalculatorDisplay } from "@/app/shell/calculator/calculator-display";
import { CalculatorKeys } from "@/app/shell/calculator/calculator-keys";
import styles from "@/app/shell/calculator/calculator.module.css";
import { useAccount } from "@/app/shell/calculator/use-account";
import { useOpenFocus } from "@/app/shell/calculator/use-open-focus";
import { usePanelPlace } from "@/app/shell/calculator/use-panel-place";
import { useT } from "@/i18n/i18n-provider";

// K8: one press of an arrow key on the grip, and with Shift.
const STEP = 16;
const LARGE_STEP = 64;

interface CalculatorWindowProps {
  open: boolean;
  onClose: () => void;
}

// The floating calculator (docs/specs/2026-11-17-floating-calculator-design.md): a window above
// the page that holds nobody.
export function CalculatorWindow({ open, onClose }: CalculatorWindowProps) {
  const t = useT();
  // Both live while the window is closed, so the account and the place are kept (K5).
  const field = useRef<HTMLInputElement>(null);
  const account = useAccount(field);
  const panel = usePanelPlace();
  useOpenFocus(open, field);

  // K21: a press on a key, on a button or on the window's ground leaves the focus, and so the
  // caret and the selection, on the account.
  function handleMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.target === field.current) return;

    event.preventDefault();
    field.current?.focus();
  }

  return (
    <FloatingPanel
      className={styles.window}
      open={open}
      messages={{ close: t("calculator.close"), move: t("calculator.move") }}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      {...(panel.place === null ? {} : { place: panel.place })}
      onPlaceChange={panel.handlePlaceChange}
      step={STEP}
      largeStep={LARGE_STEP}
      onMouseDown={handleMouseDown}
    >
      <FloatingPanelHandle>
        <FloatingPanelTitle>{t("calculator.title")}</FloatingPanelTitle>
        <FloatingPanelClose />
      </FloatingPanelHandle>

      <FloatingPanelBody>
        <CalculatorDisplay account={account} field={field} />

        <CalculatorKeys
          decimal={account.separators.decimal}
          onPress={account.press}
        />
      </FloatingPanelBody>
    </FloatingPanel>
  );
}
