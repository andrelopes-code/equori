import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

// Below an input filled from equori (design §4, "Filled inputs"): where the value came from, and
// a control that fills it again. The calculator drops the note once the value is edited.
export function FilledNote({
  origin,
  onRefill,
}: {
  origin: string;
  onRefill?: () => void;
}) {
  const t = useT();
  return (
    <Inline gap={2} align="center">
      {/* xs: the step a field's description is drawn at, so the note reads as one. */}
      <Text size="xs" tone="muted">
        {t("calc.filled", { origin })}
      </Text>
      {onRefill !== undefined && (
        <Button size="sm" variant="ghost" onClick={onRefill}>
          {t("calc.refill")}
        </Button>
      )}
    </Inline>
  );
}
