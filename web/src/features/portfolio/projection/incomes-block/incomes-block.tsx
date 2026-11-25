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
import { IncomeAdd } from "@/features/portfolio/projection/incomes-block/income-add";
import { IncomeDialog } from "@/features/portfolio/projection/incomes-block/income-dialog";
import { IncomeResult } from "@/features/portfolio/projection/incomes-block/income-result";
import { IncomeRow } from "@/features/portfolio/projection/incomes-block/income-row";
import styles from "@/features/portfolio/projection/incomes-block/incomes-block.module.css";
import { useIncomeEdit } from "@/features/portfolio/projection/incomes-block/use-income-edit";
import { journeyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { Presence } from "@/ui/dialogs/presence";

// PJ8: a plan holds at most 20 other incomes.
const maxIncomes = 20;

interface IncomesBlockProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"];
  birthDate: string;
  onChange: (incomes: OtherIncome[]) => void;
}

// PX21: the other incomes of the plan and what they change. An income edits the draft; "Salvar
// plano" stores it.
export function IncomesBlock({
  draft,
  history,
  birthDate,
  onChange,
}: IncomesBlockProps) {
  const t = useT();
  const today = useToday();
  const scale = useScale();
  const edit = useIncomeEdit(draft.incomes, onChange);

  const digits = scale?.(draft.currency) ?? 0;
  const figures = useMemo(
    () =>
      journeyFigures({ draft, history, birthDate, today, baseline: undefined }),
    [draft, history, birthDate, today],
  );
  const title = t("portfolio.projection.incomes");

  return (
    <Section size="lg" ground="surface" heading="title" aria-label={title}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>

          <SectionDescription>
            {t(
              `portfolio.projection.incomes.description.${draft.withdrawal.mode}`,
            )}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <div className={styles.body}>
          {draft.incomes.length > 0 && (
            <ul className={styles.list}>
              {draft.incomes.map((income, index) => (
                <IncomeRow
                  key={`${String(index)}-${income.name}`}
                  income={income}
                  currency={draft.currency}
                  scale={digits}
                  onEdit={() => {
                    edit.edit(index);
                  }}
                />
              ))}
            </ul>
          )}

          <IncomeAdd
            full={draft.incomes.length >= maxIncomes}
            onAdd={edit.add}
          />

          <IncomeResult
            draft={draft}
            figures={figures}
            birthDate={birthDate}
            scale={digits}
          />
        </div>

        <Presence value={edit.target}>
          {(target) => (
            <IncomeDialog
              income={target.income}
              currency={draft.currency}
              scale={digits}
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
