import { IconButton } from "@slotted/react/button";
import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { ProgressBar } from "@slotted/react/progress-indicator";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { CategoryMark } from "@/features/categories";
import { monthEnd } from "@/features/planning/agenda";
import type { BudgetRow } from "@/features/planning/budget-month";
import { budgetState, usedShare } from "@/features/planning/budget-month";
import styles from "@/features/planning/budgets.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { routeTo } from "@/ui/route-to";

type Money = components["schemas"]["Money"];
type Budget = components["schemas"]["Budget"];

const tones = { over: "danger", near: "warning", within: "accent" } as const;

// CP-04, after goal-card: one budget of the month in three lines: who, how much of it went, what
// is left. A card at the desk; on a phone a row of the group's list, with the same words.
export function BudgetCard({
  row,
  month,
  scale,
  compact,
  onChangeAmount,
  onDelete,
}: {
  row: BudgetRow;
  month: string;
  scale: (code: string) => number;
  compact: boolean;
  onChangeAmount: (budget: Budget) => void;
  onDelete: (budget: Budget, name: string) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const navigate = useNavigate();
  const p = row.progress;
  const state = budgetState(p);
  const share = usedShare(p);
  const money = (m: Money) => fmt.money(m, scale(m.currency));
  const percent = numberFormatter(locale, { style: "percent" }).format(
    share / 100,
  );
  const rest =
    state === "over"
      ? t("budget.over", {
          amount: money({ ...p.available, amount: -p.available.amount }),
        })
      : t("budget.left", { amount: money(p.available) });
  const status =
    p.carried.amount === 0
      ? rest
      : t("budget.restCarried", { rest, carried: money(p.carried) });
  const title = (
    <Inline gap={3} wrap="nowrap" className={styles.title}>
      <CategoryMark
        name={row.entry.name}
        color={row.entry.color}
        icon={row.entry.icon}
      />
      <Text size="md" weight="medium" className={styles.name}>
        <Link
          render={routeTo({
            to: "/planning/budgets/$id",
            params: { id: row.budget.id },
            search: { month },
          })}
        >
          {row.label}
        </Link>
      </Text>
    </Inline>
  );
  const actions = (
    <Inline gap={3} wrap="nowrap">
      {state !== "within" && (
        <Tag tone={tones[state]} size="sm">
          {t(state === "over" ? "budget.overspent" : "budget.near")}
        </Tag>
      )}
      <Menu>
        <MenuTrigger
          render={(props) => (
            <IconButton
              {...props}
              size="sm"
              variant="ghost"
              tone="secondary"
              aria-label={t("budget.actions", { name: row.label })}
            >
              <Icon>
                <Glyph name="ellipsis" />
              </Icon>
            </IconButton>
          )}
        />
        <MenuContent>
          <MenuItem
            onSelect={() => {
              onChangeAmount(row.budget);
            }}
          >
            {t("budget.changeAmount")}
          </MenuItem>
          <MenuItem
            onSelect={() => {
              void navigate({
                to: "/transactions",
                search: {
                  account_id: row.budget.category_id,
                  from: `${month}-01`,
                  to: monthEnd(month),
                },
              });
            }}
          >
            {t("budget.seeTransactions")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            tone="danger"
            onSelect={() => {
              onDelete(row.budget, row.label);
            }}
          >
            {t("budget.delete")}
          </MenuItem>
        </MenuContent>
      </Menu>
    </Inline>
  );
  const body: ReactNode = (
    <div className={styles.progress} data-state={state}>
      <div className={styles.spent}>
        <Text size="lg" weight="semibold" numeric="tabular">
          {money(p.spent)}
        </Text>
        <Text size="sm" tone="muted" numeric="tabular">
          {t("budget.ofPlanned", { planned: money(p.planned) })}
        </Text>
        <Text
          size="sm"
          weight="semibold"
          numeric="tabular"
          className={styles.percent}
          aria-hidden="true"
        >
          {percent}
        </Text>
      </div>
      <ProgressBar
        size="sm"
        hideLabel
        label={t("budget.meter", { name: row.label })}
        value={share}
        tone={tones[state]}
        {...(state === "over" ? { valueText: t("budget.overspent") } : {})}
      />
      <Text
        size="sm"
        tone={state === "over" ? "danger" : "muted"}
        numeric="tabular"
        className={styles.status}
        title={status}
      >
        {status}
      </Text>
    </div>
  );
  if (compact)
    return (
      <article aria-label={row.label} className={styles.row}>
        <div className={styles.rowHead}>
          {title}
          {actions}
        </div>
        {body}
      </article>
    );
  return (
    <Card
      render={(props) => <article {...props} aria-label={row.label} />}
      fill="outline"
      size="sm"
    >
      <CardHeader>
        {title}
        <CardActions>{actions}</CardActions>
      </CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
  );
}
