import { IconButton } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
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

// An arrow key moves the amount by ten units of the currency, a hundred with Shift (spec 5.2).
const stepUnits = 10;
const shiftUnits = 100;

export interface RowReview {
  suggested: number;
  checked: boolean;
  onCheck: (checked: boolean) => void;
}

// One category of the plan: what it spent, its average, the planned amount the reader edits
// and its share of the reference. The row's menu fills the amount from its history or with
// the unassigned rest, and the arrow keys step it (spec 5.2). Escape puts the saved amount back;
// the table moves focus on Enter.
export function PlanRow({
  line,
  format,
  unit,
  reference,
  rest,
  previousMonth,
  editable,
  invalid,
  lit,
  reviewing,
  review,
  onChange,
  onKeyDown,
}: {
  line: PlanLine;
  format: PlanFormat;
  unit: "money" | "share";
  reference: number | undefined;
  // The unassigned amount above zero, which the menu can add to a counted row.
  rest: number;
  previousMonth: string;
  editable: boolean;
  invalid: boolean;
  lit: boolean;
  // A suggestion is under review: every row holds the column, with or without a proposal.
  reviewing: boolean;
  review: RowReview | undefined;
  onChange: (amount: number | undefined) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useT();
  const { row, entry, label } = line;
  const saved = row.planned.amount;
  const changed = row.draft !== saved;
  const average = row.average.amount;
  const [typed, setTyped] = useState<string | null>(null);
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setTyped(null);
      onChange(undefined);
      return;
    }
    if (
      unit === "money" &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      const step =
        10 ** format.scale * (event.shiftKey ? shiftUnits : stepUnits);
      const next = row.draft + (event.key === "ArrowUp" ? step : -step);
      onChange(Math.max(0, next));
      return;
    }
    onKeyDown(event);
  };
  const fill = (amount: number) => {
    setTyped(null);
    onChange(amount);
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
          </div>
        </div>
      </TableRowHeader>
      <TableCell numeric>{format.money(row.last_month.amount)}</TableCell>

      <TableCell numeric>{format.money(average)}</TableCell>
      <TableCell numeric>
        <div className={styles.planned} data-plan-cell="">
          <div className={styles.plannedInput}>
            {input}
            {editable && !format.hidden && (
              <Menu>
                <MenuTrigger
                  render={(props) => (
                    <IconButton
                      {...props}
                      size="sm"
                      aria-label={t("plan.fill", { name: entry.name })}
                    >
                      <Icon>
                        <Glyph name="chevron-down" />
                      </Icon>
                    </IconButton>
                  )}
                />
                <MenuContent>
                  <MenuItem
                    meta={format.money(average)}
                    onSelect={() => {
                      fill(average);
                    }}
                  >
                    {t("plan.suggest.average")}
                  </MenuItem>
                  <MenuItem
                    meta={format.money(row.last_month.amount)}
                    onSelect={() => {
                      fill(row.last_month.amount);
                    }}
                  >
                    {t("plan.suggest.lastMonth", { month: previousMonth })}
                  </MenuItem>
                  {changed && (
                    <MenuItem
                      meta={format.money(saved)}
                      onSelect={() => {
                        fill(saved);
                      }}
                    >
                      {t("plan.fill.saved")}
                    </MenuItem>
                  )}
                  {row.counted && rest > 0 && (
                    <MenuItem
                      meta={format.signed(rest)}
                      onSelect={() => {
                        fill(row.draft + rest);
                      }}
                    >
                      {t("plan.fill.rest")}
                    </MenuItem>
                  )}
                  {row.draft > 0 && <MenuSeparator />}
                  {row.draft > 0 && (
                    <MenuItem
                      onSelect={() => {
                        fill(0);
                      }}
                    >
                      {t("plan.fill.zero")}
                    </MenuItem>
                  )}
                </MenuContent>
              </Menu>
            )}
          </div>
          {changed && (
            <Text size="xs" tone="muted" numeric="tabular">
              {t("plan.was", { amount: format.money(saved) })}
            </Text>
          )}
        </div>
      </TableCell>
      <TableCell numeric>{share ?? t("plan.dash")}</TableCell>
      {reviewing && (
        <TableCell numeric>
          {review !== undefined && (
            <div className={styles.suggested}>
              <div className={styles.suggestedText}>
                <Text
                  size="sm"
                  weight="medium"
                  numeric="tabular"
                  tone={review.checked ? "default" : "muted"}
                >
                  {format.money(review.suggested)}
                </Text>
                <Text
                  size="xs"
                  numeric="tabular"
                  tone={review.checked ? "accent" : "muted"}
                >
                  {row.budget_id === undefined && row.draft === 0
                    ? t("plan.new")
                    : format.signed(delta)}
                </Text>
              </div>
              <Checkbox
                aria-label={t("plan.take", { name: entry.name })}
                checked={review.checked}
                onCheckedChange={(checked) => {
                  review.onCheck(checked);
                }}
              />
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}
