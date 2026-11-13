import { Accordion } from "@slotted/react/accordion";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/outside/outside-section.module.css";
import type { MemberRef } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { instrumentPickerItem } from "@/features/portfolio/contribution-plan/editor/picker-entries";
import { memberRefOf } from "@/features/portfolio/contribution-plan/model/plan-from-portfolio";
import { instrumentsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type Plan = components["schemas"]["ContributionPlan"];

interface OutsideSectionProps {
  view: Plan;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onChoose: (classIndex: number, ref: MemberRef) => void;
}

// The positions no group holds, collapsed under one line, each with a group to put it in (spec,
// Outside the plan).
export function OutsideSection({
  view,
  memberName,
  onChoose,
}: OutsideSectionProps) {
  const t = useT();
  const api = useApi();
  const instruments = useQuery(instrumentsQuery(api));
  const fmt = useMoneyFormat();
  const scale = useScale();

  if (view.outside.length === 0) return null;

  const catalog = new Map(
    (instruments.data?.items ?? []).map((i) => [
      i.code,
      instrumentPickerItem(i),
    ]),
  );
  const choices = view.classes.map((cls, i) => ({
    value: String(i),
    label: cls.name,
  }));

  const valued = view.outside.flatMap((e) => (e.value ? [e.value] : []));
  const total = {
    amount: valued.reduce((sum, v) => sum + v.amount, 0),
    currency: view.total.currency,
  };
  const count = t(
    view.outside.length === 1
      ? "contributionPlan.outsideOne"
      : "contributionPlan.outsideMany",
    { count: view.outside.length },
  );
  const summary =
    valued.length === 0
      ? count
      : t("contributionPlan.outsideWithTotal", {
          summary: count,
          total: fmt.money(total, scale?.(total.currency) ?? 0),
        });

  return (
    <Accordion variant="framed" size="sm">
      <Collapsible value="outside">
        <CollapsibleHeader>
          <CollapsibleTrigger>{summary}</CollapsibleTrigger>
        </CollapsibleHeader>

        <CollapsiblePanel>
          <section
            aria-label={t("contributionPlan.outside")}
            className={styles.section}
          >
            {view.outside.map((entry) => {
              const name = memberName(entry);
              const item =
                entry.instrument === undefined
                  ? undefined
                  : catalog.get(entry.instrument);

              return (
                <div
                  key={entry.account_id ?? entry.instrument}
                  className={styles.row}
                >
                  <div className={styles.name}>
                    <Text className={styles.label}>{item?.name ?? name}</Text>

                    {item !== undefined && (
                      <Text tone="muted">{item.code}</Text>
                    )}
                  </div>

                  <Text
                    className={styles.value}
                    tone={entry.value === undefined ? "muted" : undefined}
                  >
                    {entry.value === undefined
                      ? t("contributionPlan.noPrice")
                      : fmt.money(
                          entry.value,
                          scale?.(entry.value.currency) ?? 0,
                        )}
                  </Text>

                  <ChoiceSelect
                    label={t("contributionPlan.moveTo", { name })}
                    placeholder={t("contributionPlan.chooseClass")}
                    choices={choices}
                    value={null}
                    multiple={false}
                    onChange={(next) => {
                      onChoose(Number(next), memberRefOf(entry));
                    }}
                  />
                </div>
              );
            })}
          </section>
        </CollapsiblePanel>
      </Collapsible>
    </Accordion>
  );
}
