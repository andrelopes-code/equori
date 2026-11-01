import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { CheckboxGroup } from "@slotted/react/checkbox-group";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";

import { InstitutionField } from "@/features/accounts";
import { startKinds } from "@/features/start/start-drafts";
import type {
  StartKind,
  StartRow as StartRowValue,
} from "@/features/start/start-drafts";
import { useT } from "@/i18n/i18n-provider";

interface StartRowProps {
  row: StartRowValue;
  removable: boolean;
  onChange: (next: StartRowValue) => void;
  onRemove: () => void;
}

// One institution of the walkthrough and the kinds of account held there.
export function StartRow({
  row,
  removable,
  onChange,
  onRemove,
}: StartRowProps) {
  const t = useT();
  const chosen = row.institutionId !== null;

  return (
    <Stack gap={4}>
      <Inline gap={3} align="end" wrap="wrap">
        <Field required>
          <FieldLabel>{t("start.where.institution")}</FieldLabel>
          <InstitutionField
            value={row.institutionId}
            aria-label={t("start.where.institution")}
            onChange={(institutionId, name) => {
              onChange({
                ...row,
                institutionId,
                institutionName: institutionId === null ? "" : (name ?? ""),
              });
            }}
          />
        </Field>
        {removable && (
          <Button variant="ghost" tone="secondary" onClick={onRemove}>
            {t("start.where.removeRow")}
          </Button>
        )}
      </Inline>

      {chosen && (
        <Field invalid={row.kinds.length === 0}>
          <FieldGroup necessity="none">
            <FieldGroupLegend>
              {t("start.where.kinds", { institution: row.institutionName })}
            </FieldGroupLegend>
            <FieldGroupContent>
              <CheckboxGroup
                value={row.kinds}
                onValueChange={(kinds) => {
                  onChange({
                    ...row,
                    kinds: startKinds.filter((kind) => kinds.includes(kind)),
                  });
                }}
              >
                {startKinds.map((kind: StartKind) => (
                  <Checkbox key={kind} value={kind}>
                    {t(`kind.title.${kind}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </FieldGroupContent>
          </FieldGroup>
          {row.kinds.length === 0 && (
            <FieldError>{t("start.where.kindsRequired")}</FieldError>
          )}
        </Field>
      )}
    </Stack>
  );
}
