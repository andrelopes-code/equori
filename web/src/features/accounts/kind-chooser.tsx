import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Grid } from "@slotted/react/grid";
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Stack } from "@slotted/react/stack";

import {
  kindGroupLabel,
  kindGroups,
  kindHint,
  kindTitle,
} from "@/features/accounts/account-kinds";
import type { Kind } from "@/features/accounts/account-kinds";
import { useT } from "@/i18n/i18n-provider";

// One tile per kind, in the four groups a reader looks for an account in. Each group is its
// own radio set sharing the name, so the arrow keys stay inside a heading; the grid inside the
// set gives the tiles equal widths, as the family's tile example composes it.
export function KindChooser({
  value,
  onChange,
}: {
  value: Kind | null;
  onChange: (kind: Kind) => void;
}) {
  const t = useT();
  return (
    <Stack gap={6}>
      {kindGroups.map((group) => (
        <FieldGroup necessity="none" key={group.key}>
          <FieldGroupLegend>{t(kindGroupLabel[group.key])}</FieldGroupLegend>
          <FieldGroupContent>
            <RadioGroup
              name="kind"
              variant="tile"
              value={value !== null && group.kinds.includes(value) ? value : ""}
              onValueChange={(next) => {
                const kind = group.kinds.find((k) => k === next);
                if (kind !== undefined) onChange(kind);
              }}
            >
              <Grid gap={3} minItemWidth="sm">
                {group.kinds.map((kind) => (
                  <Radio
                    key={kind}
                    value={kind}
                    description={t(kindHint[kind])}
                  >
                    {t(kindTitle[kind])}
                  </Radio>
                ))}
              </Grid>
            </RadioGroup>
          </FieldGroupContent>
        </FieldGroup>
      ))}
    </Stack>
  );
}
