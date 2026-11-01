import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { StartRow } from "@/features/start/start-row";
import type { StartRow as StartRowValue } from "@/features/start/start-drafts";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";

interface StartWhereStepProps {
  rows: readonly StartRowValue[];
  cash: boolean;
  canContinue: boolean;
  onRowChange: (next: StartRowValue) => void;
  onRowRemove: (key: string) => void;
  onRowAdd: () => void;
  onCashChange: (cash: boolean) => void;
  onContinue: () => void;
  onNotNow: () => void;
}

// Step 1: the institutions the reader uses, what is held at each and whether cash is kept.
export function StartWhereStep({
  rows,
  cash,
  canContinue,
  onRowChange,
  onRowRemove,
  onRowAdd,
  onCashChange,
  onContinue,
  onNotNow,
}: StartWhereStepProps) {
  const t = useT();

  return (
    <Stack gap={6}>
      <Text tone="muted">{t("start.where.hint")}</Text>

      <FormLayout>
        <Stack gap={6}>
          {rows.map((row) => (
            <StartRow
              key={row.key}
              row={row}
              removable={rows.length > 1}
              onChange={onRowChange}
              onRemove={() => {
                onRowRemove(row.key);
              }}
            />
          ))}
          <Inline>
            <Button variant="outline" tone="secondary" onClick={onRowAdd}>
              {t("start.where.addRow")}
            </Button>
          </Inline>
          <Checkbox checked={cash} onCheckedChange={onCashChange}>
            {t("start.where.cash")}
          </Checkbox>
        </Stack>
      </FormLayout>

      <Inline gap={3} wrap="wrap">
        <Button variant="ghost" tone="secondary" onClick={onNotNow}>
          {t("start.notNow")}
        </Button>
        <Button disabled={!canContinue} onClick={onContinue}>
          {t("start.continue")}
        </Button>
      </Inline>
    </Stack>
  );
}
