import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/outside/outside-section.module.css";
import type { MemberRef } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { memberRefOf } from "@/features/portfolio/contribution-plan/model/plan-from-portfolio";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type Plan = components["schemas"]["ContributionPlan"];

interface OutsideSectionProps {
  view: Plan;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onChoose: (classIndex: number, ref: MemberRef) => void;
}

// The positions no class holds, each with a class to put it in (spec, Outside the plan).
export function OutsideSection({
  view,
  memberName,
  onChoose,
}: OutsideSectionProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();

  if (view.outside.length === 0) return null;

  const choices = view.classes.map((cls, i) => ({
    value: String(i),
    label: cls.name,
  }));

  return (
    <section
      aria-label={t("contributionPlan.outside")}
      className={styles.section}
    >
      <Text weight="semibold">{t("contributionPlan.outside")}</Text>

      {view.outside.map((entry) => {
        const name = memberName(entry);

        return (
          <div
            key={entry.account_id ?? entry.instrument}
            className={styles.row}
          >
            <Text className={styles.name}>{name}</Text>

            <Text className={styles.value}>
              {entry.value !== undefined &&
                fmt.money(entry.value, scale?.(entry.value.currency) ?? 0)}
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
  );
}
