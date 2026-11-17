import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import {
  fromLabelKey,
  periodKey,
} from "@/features/planning/income-split/versions/bucket-versions";
import type { FromChoice } from "@/features/planning/income-split/versions/bucket-versions";
import { useMonthNames } from "@/features/planning/income-split/use-month-names";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

interface BucketValidFromProps {
  // The versions are still loading.
  pending: boolean;
  choices: readonly FromChoice[];
  chosen: FromChoice | undefined;
  // The last month the chosen start covers; undefined while it runs on.
  until: string | undefined;
  onChange: (from: string) => void;
}

// The start of the version a save writes, beside the button that saves it, and where its
// period ends (A240, dialog spec A251).
export function BucketValidFrom({
  pending,
  choices,
  chosen,
  until,
  onChange,
}: BucketValidFromProps) {
  const t = useT();
  const names = useMonthNames([]);

  if (pending)
    return (
      <div className={styles.validFrom}>
        <span className={styles.pending} aria-busy="true" />
      </div>
    );

  if (chosen === undefined) return null;

  const month = (from: string) => names.longYear(from);
  const period = t(periodKey(chosen, until !== undefined), {
    from: month(chosen.from),
    until: until === undefined ? "" : month(until),
  });

  return (
    <div className={styles.validFrom}>
      <div className={styles.validSelect}>
        <ChoiceSelect
          label={t("buckets.from.label")}
          multiple={false}
          value={chosen.from}
          choices={choices.map((c) => ({
            value: c.from,
            label: t(fromLabelKey(c), { month: month(c.from) }),
          }))}
          onChange={(next) => {
            if (typeof next === "string") onChange(next);
          }}
        />
      </div>
      <Text size="sm" tone="muted" className={styles.until}>
        {period}
      </Text>
    </div>
  );
}
