import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { ChangeAdd } from "@/features/portfolio/projection/contributions-block/change-add";
import { ChangeDialog } from "@/features/portfolio/projection/contributions-block/change-dialog";
import { projectBase } from "@/features/portfolio/projection/contributions-block/change-effect";
import { ChangeRow } from "@/features/portfolio/projection/contributions-block/change-row";
import styles from "@/features/portfolio/projection/contributions-block/contributions-block.module.css";
import { ContributionsKey } from "@/features/portfolio/projection/contributions-block/contributions-key";
import { ContributionsPlot } from "@/features/portfolio/projection/contributions-block/contributions-plot";
import { contributionRows } from "@/features/portfolio/projection/contributions-block/contributions-rows";
import {
  othersOf,
  useContributionEdit,
} from "@/features/portfolio/projection/contributions-block/use-contribution-edit";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { Presence } from "@/ui/dialogs/presence";

type Change = components["schemas"]["ProjectionChange"];

// PJ2: a plan holds at most 40 changes.
const maxChanges = 40;

interface ContributionsBlockProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"];
  birthDate: string;
  onChange: (changes: Change[]) => void;
}

// PX8, PX9: the changes of the planned contribution beside the recorded contributions and the
// intention. A change edits the draft; "Salvar plano" stores it.
export function ContributionsBlock({
  draft,
  history,
  birthDate,
  onChange,
}: ContributionsBlockProps) {
  const t = useT();
  const today = useToday();
  const scale = useScale();
  const edit = useContributionEdit(draft.changes, onChange);

  const digits = scale?.(draft.currency) ?? 0;
  const current = today.slice(0, 7);
  const base = useMemo(
    () => projectBase(draft, history, birthDate, today),
    [draft, history, birthDate, today],
  );
  const rows = contributionRows(
    history.points,
    draft.changes,
    current,
    base.withdrawalFrom,
    digits,
  );

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.projection.contributions")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("portfolio.projection.contributions")}
          </SectionHeading>

          <SectionDescription>
            {t("portfolio.projection.contributions.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <div className={styles.hero}>
          <div className={styles.heroSide}>
            <ul className={styles.stepList}>
              {draft.changes.map((change, index) => (
                <ChangeRow
                  key={change.month}
                  change={change}
                  first={index === 0}
                  past={change.month.slice(0, 7) < current}
                  currency={draft.currency}
                  scale={digits}
                  onEdit={() => {
                    edit.edit(change);
                  }}
                />
              ))}
            </ul>

            <ChangeAdd
              full={draft.changes.length >= maxChanges}
              started={base.withdrawalFrom <= current}
              onAdd={edit.add}
            />
          </div>

          <div className={styles.heroPlot}>
            <ContributionsKey />

            <ContributionsPlot
              rows={rows}
              today={history.points.at(-1)?.date}
              currency={draft.currency}
              scale={digits}
            />
          </div>
        </div>

        <Presence value={edit.target}>
          {(target) => (
            <ChangeDialog
              target={target}
              others={othersOf(draft.changes, target)}
              current={current}
              base={base}
              age={draft.withdrawalAge}
              currency={draft.currency}
              scale={digits}
              removable={target.change !== null && draft.changes.length > 1}
              onSave={edit.save}
              onRemove={edit.remove}
              onCancel={edit.close}
            />
          )}
        </Presence>
      </SectionBody>
    </Section>
  );
}
