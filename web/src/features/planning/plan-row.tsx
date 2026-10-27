import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useState } from "react";
import type { KeyboardEvent } from "react";

import { CategoryMark } from "@/features/categories";
import styles from "@/features/planning/budget-plan.module.css";
import type { PlanLine } from "@/features/planning/plan-groups";
import {
  bpFromText,
  fromShare,
  planShare,
  textFromBp,
} from "@/features/planning/plan-math";
import type { PlanFormat } from "@/features/planning/use-plan-format";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";

// The average chip shows when the plan is this share of the average away from it (spec 5.2).
const hintBp = 1000;

export interface RowReview {
  suggested: number;
  checked: boolean;
  onCheck: (checked: boolean) => void;
}

// One category of the plan: what it spent, its average, the planned amount the reader edits
// and its share of the reference. Escape puts the saved amount back; the table moves focus on
// Enter.
export function PlanRow({
  line,
  format,
  unit,
  reference,
  editable,
  invalid,
  lit,
  compact,
  review,
  onChange,
  onKeyDown,
}: {
  line: PlanLine;
  format: PlanFormat;
  unit: "money" | "share";
  reference: number | undefined;
  editable: boolean;
  invalid: boolean;
  lit: boolean;
  compact: boolean;
  review: RowReview | undefined;
  onChange: (amount: number | undefined) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useT();
  const { row, entry, label } = line;
  const saved = row.planned.amount;
  const changed = row.draft !== saved;
  const average = row.average.amount;
  const away =
    average > 0 && Math.abs(row.draft - average) * 10000 >= average * hintBp;
  const [typed, setTyped] = useState<string | null>(null);
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setTyped(null);
      onChange(undefined);
      return;
    }
    onKeyDown(event);
  };
  const name = t("plan.input", { name: entry.name });
  let input;
  if (format.hidden || !editable) {
    input = (
      <Text size="sm" numeric="tabular">
        {format.money(row.draft)}
      </Text>
    );
  } else if (unit === "share" && reference !== undefined && reference > 0) {
    input = (
      <TextField
        size="sm"
        inputMode="decimal"
        autoComplete="off"
        aria-label={t("plan.shareInput", { name: entry.name })}
        invalid={invalid}
        value={typed ?? textFromBp(planShare(row.draft, reference) ?? 0)}
        end="%"
        onChange={(event) => {
          setTyped(event.target.value);
          const bp = bpFromText(event.target.value);
          if (bp !== undefined) onChange(fromShare(bp, reference));
        }}
        onBlur={() => {
          setTyped(null);
        }}
        onKeyDown={keys}
      />
    );
  } else {
    input = (
      <MoneyInput
        size="field"
        aria-label={name}
        invalid={invalid}
        value={row.draft}
        currency={format.currency}
        scale={format.scale}
        sign="neutral"
        onChange={(amount) => {
          onChange(amount);
        }}
        onKeyDown={keys}
      />
    );
  }
  const share = format.share(
    reference === undefined ? undefined : planShare(row.draft, reference),
  );
  const delta = review === undefined ? 0 : review.suggested - row.draft;
  return (
    <TableRow
      data-lit={lit ? "" : undefined}
      data-changed={changed ? "" : undefined}
    >
      <TableRowHeader>
        <div className={styles.category}>
          <CategoryMark
            name={entry.name}
            color={entry.color}
            icon={entry.icon}
          />
          <div className={styles.categoryText}>
            <Text size="sm" weight="medium">
              {label}
            </Text>
            {line.inside !== undefined && (
              <Text size="xs" tone="muted">
                {t("plan.inside", { name: line.inside })}
              </Text>
            )}
            {compact && (
              <Text size="xs" tone="muted" numeric="tabular">
                {t("plan.history", {
                  last: format.money(row.last_month.amount),
                  average: format.money(average),
                })}
              </Text>
            )}
          </div>
        </div>
      </TableRowHeader>
      {!compact && (
        <TableCell numeric>{format.money(row.last_month.amount)}</TableCell>
      )}
      {!compact && <TableCell numeric>{format.money(average)}</TableCell>}
      <TableCell numeric>
        <div className={styles.planned} data-plan-cell="">
          <div className={styles.plannedInput}>
            {away && editable && !format.hidden && review === undefined && (
              <Button
                size="sm"
                variant="ghost"
                tone="accent"
                onClick={() => {
                  setTyped(null);
                  onChange(average);
                }}
              >
                {t("plan.averageChip", { amount: format.money(average) })}
              </Button>
            )}
            {input}
          </div>
          {changed && (
            <Text size="xs" tone="muted" numeric="tabular">
              {t("plan.was", { amount: format.money(saved) })}
            </Text>
          )}
        </div>
      </TableCell>
      <TableCell numeric>{share ?? t("plan.dash")}</TableCell>
      {review !== undefined && (
        <TableCell numeric>
          <div className={styles.suggested}>
            <Text size="xs" weight="semibold" tone="accent" numeric="tabular">
              {row.budget_id === undefined && row.draft === 0
                ? t("plan.new")
                : format.signed(delta)}
            </Text>
            <Text size="sm" weight="medium" numeric="tabular">
              {format.money(review.suggested)}
            </Text>
            <Checkbox
              aria-label={t("plan.take", { name: entry.name })}
              checked={review.checked}
              onCheckedChange={(checked) => {
                review.onCheck(checked);
              }}
            />
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
