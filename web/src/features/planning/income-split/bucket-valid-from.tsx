import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import {
  fromLabelKey,
  periodKey,
} from "@/features/planning/income-split/bucket-versions";
import type { FromChoice } from "@/features/planning/income-split/bucket-versions";
import { useMonthNames } from "@/features/planning/income-split/use-month-names";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

interface BucketValidFromProps {
  choices: readonly FromChoice[];
  chosen: FromChoice | undefined;
  // The last month the chosen start covers; undefined while it runs on.
  until: string | undefined;
  onChange: (from: string) => void;
}

// The start of the version a save writes, and the period it covers (A240).
export function BucketValidFrom({
  choices,
  chosen,
  until,
  onChange,
}: BucketValidFromProps) {
  const t = useT();
  const names = useMonthNames([]);

  if (chosen === undefined) return null;

  const month = (from: string) => names.longYear(from);
  const first = chosen.kind === "version" && chosen.first;
  const vars = {
    from: month(chosen.from),
    until: until === undefined ? "" : month(until),
  };
  const period = t(periodKey(chosen, until !== undefined), vars);

  return (
    <Stack gap={2}>
      <Text size="sm" weight="medium">
        {t("buckets.from.label")}
      </Text>
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
      <Text size="sm" tone="muted">
        {period}
      </Text>
      {!first && (
        <Text size="sm" tone="muted">
          {t("buckets.from.keeps")}
        </Text>
      )}
    </Stack>
  );
}
