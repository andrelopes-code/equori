import { Glyph, Icon } from "@slotted/react/icon";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { Fragment } from "react";
import type { KeyboardEvent } from "react";

import styles from "@/features/planning/budget-plan.module.css";
import type { PlanGroup } from "@/features/planning/plan-groups";
import { planShare } from "@/features/planning/plan-math";
import { PlanRow } from "@/features/planning/plan-row";
import type { RowReview } from "@/features/planning/plan-row";
import type { PlanFormat } from "@/features/planning/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

// Enter moves to the next row's amount and Shift+Enter to the previous one, in the order the
// table shows them; a collapsed group holds no input to land on.
function step(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const table = target.closest("table");
  if (table === null) return;
  const inputs = [
    ...table.querySelectorAll<HTMLInputElement>("[data-plan-cell] input"),
  ];
  const at = inputs.indexOf(target);
  inputs[at + (event.shiftKey ? -1 : 1)]?.focus();
}

// The plan by top-level category (spec 5.1): a group row sums its counted rows, folds them
// away and lights with its segment of the bar.
export function PlanTable({
  caption,
  groups,
  collapsed,
  previousMonth,
  format,
  unit,
  reference,
  rest,
  editable,
  invalid,
  highlighted,
  compact,
  review,
  onToggle,
  onHighlight,
  onChange,
}: {
  caption: string;
  groups: readonly PlanGroup[];
  collapsed: ReadonlySet<string>;
  previousMonth: string;
  format: PlanFormat;
  unit: "money" | "share";
  reference: number | undefined;
  rest: number;
  editable: boolean;
  invalid: ReadonlySet<string>;
  highlighted: string | null;
  compact: boolean;
  review: ReadonlyMap<string, RowReview> | undefined;
  onToggle: (group: string) => void;
  onHighlight: (group: string | null) => void;
  onChange: (categoryId: string, amount: number | undefined) => void;
}) {
  const t = useT();
  const columns = (compact ? 3 : 5) + (review === undefined ? 0 : 1);
  return (
    <Table columns={columns} variant="framed">
      <TableContent>
        <TableCaption>
          <VisuallyHidden>{caption}</VisuallyHidden>
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("plan.col.category")}</TableColumnHeader>
            {!compact && (
              <TableColumnHeader numeric>
                {t("plan.col.lastMonth", { month: previousMonth })}
              </TableColumnHeader>
            )}
            {!compact && (
              <TableColumnHeader numeric>
                {t("plan.col.average")}
              </TableColumnHeader>
            )}
            <TableColumnHeader numeric>
              {t("plan.col.planned")}
            </TableColumnHeader>
            <TableColumnHeader numeric>{t("plan.col.share")}</TableColumnHeader>
            {review !== undefined && (
              <TableColumnHeader numeric>
                {t("plan.col.suggested")}
              </TableColumnHeader>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((group) => {
            const open = !collapsed.has(group.id);
            const lit = highlighted === group.id;
            return (
              <Fragment key={group.id}>
                <TableRow
                  className={styles.groupRow}
                  data-lit={lit ? "" : undefined}
                  onMouseEnter={() => {
                    onHighlight(group.id);
                  }}
                  onMouseLeave={() => {
                    onHighlight(null);
                  }}
                >
                  <TableRowHeader id={`plan-group-${group.id}`}>
                    {/* The disclosure of a group, drawn here because a ghost button pads its
                        icon apart from the label; the chevron stands in the column of the
                        category marks below it so the names line up. */}
                    <button
                      type="button"
                      className={styles.groupToggle}
                      aria-expanded={open}
                      aria-label={t("plan.toggle", { name: group.name })}
                      onClick={() => {
                        onToggle(group.id);
                      }}
                    >
                      <span className={styles.chevronSlot} aria-hidden="true">
                        <span className={styles.chevron}>
                          <Icon>
                            <Glyph name="chevron-down" />
                          </Icon>
                        </span>
                      </span>
                      <Text size="sm" weight="semibold">
                        {group.name}
                      </Text>
                    </button>
                  </TableRowHeader>
                  {!compact && (
                    <TableCell numeric>
                      {format.money(group.lastMonth)}
                    </TableCell>
                  )}
                  {!compact && (
                    <TableCell numeric>{format.money(group.average)}</TableCell>
                  )}
                  <TableCell numeric>
                    <Text size="sm" weight="semibold" numeric="tabular">
                      {format.money(group.draft)}
                    </Text>
                  </TableCell>
                  <TableCell numeric>
                    {format.share(
                      reference === undefined
                        ? undefined
                        : planShare(group.draft, reference),
                    ) ?? t("plan.dash")}
                  </TableCell>
                  {review !== undefined && <TableCell />}
                </TableRow>
                {open &&
                  group.lines.map((line) => (
                    <PlanRow
                      key={line.row.category_id}
                      line={line}
                      format={format}
                      unit={unit}
                      reference={reference}
                      rest={rest}
                      previousMonth={previousMonth}
                      editable={editable}
                      invalid={invalid.has(line.row.category_id)}
                      lit={lit}
                      compact={compact}
                      reviewing={review !== undefined}
                      review={review?.get(line.row.category_id)}
                      onChange={(amount) => {
                        onChange(line.row.category_id, amount);
                      }}
                      onKeyDown={step}
                    />
                  ))}
              </Fragment>
            );
          })}
        </TableBody>
      </TableContent>
    </Table>
  );
}
