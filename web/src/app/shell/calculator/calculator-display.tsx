import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import type { RefObject } from "react";

import styles from "@/app/shell/calculator/calculator.module.css";
import type { AccountControl } from "@/app/shell/calculator/use-account";
import { useT } from "@/i18n/i18n-provider";

interface CalculatorDisplayProps {
  account: AccountControl;
  field: RefObject<HTMLInputElement | null>;
}

// K20: above this length the result takes the smaller size.
const LONG_RESULT = 12;

// The account on one line and its result under it.
export function CalculatorDisplay({ account, field }: CalculatorDisplayProps) {
  const t = useT();

  const { outcome, result } = account;
  const failure =
    outcome.kind === "error"
      ? t(
          outcome.code === "division_by_zero"
            ? "calculator.divisionByZero"
            : "calculator.tooLarge",
        )
      : null;

  return (
    <div className={styles.display} data-part="display">
      <input
        ref={field}
        className={styles.expression}
        data-part="expression"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={t("calculator.account")}
        value={account.drawn.text}
        onChange={account.handleChange}
        onKeyDown={account.handleKeyDown}
      />

      <div className={styles.answer}>
        {outcome.kind === "value" && (
          <IconButton
            size="sm"
            aria-label={t(
              account.copied ? "calculator.copied" : "calculator.copy",
            )}
            onClick={account.copy}
          >
            <Icon size="sm">
              <Glyph name={account.copied ? "check" : "copy"} />
            </Icon>
          </IconButton>
        )}

        <output
          className={styles.result}
          data-part="result"
          aria-label={t("calculator.result")}
          data-idle={outcome.kind === "empty" || undefined}
          data-invalid={failure !== null || undefined}
          data-long={result.length > LONG_RESULT || undefined}
        >
          {failure ?? (outcome.kind === "empty" ? 0 : result)}
        </output>
      </div>
    </div>
  );
}
