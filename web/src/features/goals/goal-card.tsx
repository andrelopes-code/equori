import { IconButton } from "@slotted/react/button";
import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";

import { GoalMeter } from "@/features/goals/goal-meter";
import { GoalParts } from "@/features/goals/goal-parts";
import { goalState, monthsLeft } from "@/features/goals/goal-state";
import type { Goal } from "@/features/goals/goal-line";
import { GoalWhatIf } from "@/features/goals/goal-what-if";
import styles from "@/features/goals/goals.module.css";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// One goal: the ring says how far it is, the figures say what is left and by when, and the
// what-if says what each month's saving does to the completion month.
export function GoalCard({
  goal,
  scale,
  scheduled,
  investing,
  names,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  scale: (code: string) => number;
  scheduled: number;
  investing: boolean;
  names: ReadonlyMap<string, string>;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();
  const state = goalState(goal, today);
  const left = monthsLeft(today, goal.due_on);
  const money = (m: Goal["target"]) => fmt.money(m, scale(m.currency));
  const percent = numberFormatter(locale, { style: "percent" }).format(
    Math.floor(goal.progress_bp / 100) / 100,
  );
  const tone =
    state === "reached" ? "success" : state === "overdue" ? "danger" : "accent";
  // The latest date among the prices that valued a security of the goal.
  const valued = goal.prices
    ?.map((p) => p.date)
    .sort()
    .pop();
  const figures = [
    ["goals.target", money(goal.target)],
    ["goals.remaining", money(goal.remaining)],
    ["goals.due", formatDate(goal.due_on, locale)],
  ] as const;
  return (
    <Card
      render={(props) => <article {...props} aria-label={goal.name} />}
      fill="outline"
    >
      <CardHeader>
        <Heading level={3} size="md">
          {goal.name}
        </Heading>
        <CardActions>
          {state === "reached" ? (
            <Tag tone="success" size="sm">
              {t("goals.state.reached")}
            </Tag>
          ) : state === "overdue" ? (
            <Tag tone="danger" size="sm">
              {t("goals.state.overdue")}
            </Tag>
          ) : (
            <Tag size="sm">
              {left === 0
                ? t("goals.leftNow")
                : t(left === 1 ? "goals.leftOne" : "goals.left", {
                    count: left,
                  })}
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
                  aria-label={t("goals.more")}
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
                  onEdit(goal);
                }}
              >
                {t("goals.edit")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                tone="danger"
                onSelect={() => {
                  onDelete(goal);
                }}
              >
                {t("goals.delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        </CardActions>
      </CardHeader>
      <CardBody>
        <div className={styles.progress} data-tone={tone}>
          <div className={styles.saved}>
            <div className={styles.savedText}>
              <Text size="sm" tone="muted">
                {t("goals.saved")}
              </Text>
              <Text size="xl" weight="semibold" numeric="tabular">
                {money(goal.current)}
              </Text>
            </div>
            <Text
              size="lg"
              weight="semibold"
              numeric="tabular"
              className={styles.percent}
              aria-hidden="true"
            >
              {percent}
            </Text>
          </div>
          <GoalMeter
            label={goal.name}
            basisPoints={goal.progress_bp}
            text={percent}
          />
          {valued !== undefined && (
            <Text size="xs" tone="muted">
              {t("goals.valuedAt", { date: formatDate(valued, locale) })}
            </Text>
          )}
        </div>
        <dl className={styles.figures}>
          {figures.map(([key, value]) => (
            <div key={key} className={styles.figure}>
              <Text
                size="sm"
                tone="muted"
                render={(props) => <dt {...props} />}
              >
                {t(key)}
              </Text>
              <Text
                size="sm"
                weight="medium"
                numeric="tabular"
                className={styles.value}
                render={(props) => <dd {...props} />}
              >
                {value}
              </Text>
            </div>
          ))}
        </dl>
        <GoalParts goal={goal} scale={scale} names={names} />
        {state !== "reached" && (
          <GoalWhatIf
            goal={goal}
            scale={scale(goal.target.currency)}
            scheduled={scheduled}
            investing={investing}
          />
        )}
      </CardBody>
    </Card>
  );
}
