import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { LifeHead } from "@/features/portfolio/projection/plan-section/life-head";
import { PlanGroup } from "@/features/portfolio/projection/plan-section/plan-group";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { PendingRow } from "@/features/portfolio/projection/states/pending-row";
import { PendingStop } from "@/features/portfolio/projection/states/pending-stop";
import { useT } from "@/i18n/i18n-provider";

// PX11: the plan section while its reads are pending; every static text stays, values wait.
export function ProjectionPending() {
  const t = useT();

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.projection.plan.title")}
      aria-busy="true"
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("portfolio.projection.plan.title")}
          </SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <div className={styles.life}>
          <div className={styles.lifeStop}>
            <LifeHead line="before" />
            <PendingStop label={t("portfolio.projection.plan.today")} />
          </div>

          <div className={styles.lifeStop}>
            <LifeHead line="after" />

            <div className={styles.lifeControls}>
              <PendingStop
                label={t("portfolio.projection.plan.withdrawalAge")}
              />
              <PendingStop label={t("portfolio.projection.plan.withdrawal")} />
              <PendingStop label={t("portfolio.projection.plan.income")} />
            </div>
          </div>

          <div className={styles.lifeStop}>
            <LifeHead line={null} />
            <PendingStop label={t("portfolio.projection.plan.lastAge")} />
          </div>
        </div>

        <div className={styles.planGroups}>
          <PlanGroup
            legend={t("portfolio.projection.plan.returns")}
            description={t("portfolio.projection.plan.returnsDescription")}
          >
            <PendingRow label={t("portfolio.projection.plan.realReturn")} />
            <PendingRow label={t("portfolio.projection.plan.cautious")} />
            <PendingRow label={t("portfolio.projection.plan.favorable")} />
          </PlanGroup>

          <PlanGroup
            legend={t("portfolio.projection.plan.costs")}
            description={t("portfolio.projection.plan.costsDescription")}
          >
            <PendingRow
              label={t("portfolio.projection.plan.withdrawalReturn")}
            />
            <PendingRow label={t("portfolio.projection.plan.inflation")} />
            <PendingRow label={t("portfolio.projection.plan.gainTax")} />
          </PlanGroup>
        </div>
      </SectionBody>
    </Section>
  );
}
