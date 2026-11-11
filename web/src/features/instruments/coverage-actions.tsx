import { Button } from "@slotted/react/button";
import { Toolbar } from "@slotted/react/toolbar";

import { useT } from "@/i18n/i18n-provider";

interface CoverageActionsProps {
  canLoad: boolean;
  canImport: boolean;
  canRecord: boolean;
  onLoad: () => void;
  onImport: () => void;
  onRecord: () => void;
}

// A223 RM10: the actions of the quotes of one instrument, in one toolbar of equal buttons.
export function CoverageActions({
  canLoad,
  canImport,
  canRecord,
  onLoad,
  onImport,
  onRecord,
}: CoverageActionsProps) {
  const t = useT();

  if (!canLoad && !canImport && !canRecord) return null;

  return (
    <Toolbar aria-label={t("instruments.actions")} size="sm">
      {canLoad && (
        <Button size="sm" variant="outline" tone="secondary" onClick={onLoad}>
          {t("instruments.history.load")}
        </Button>
      )}
      {canImport && (
        <Button size="sm" variant="outline" tone="secondary" onClick={onImport}>
          {t("prices.import.one")}
        </Button>
      )}
      {canRecord && (
        <Button size="sm" variant="outline" tone="secondary" onClick={onRecord}>
          {t("instrument.price.record")}
        </Button>
      )}
    </Toolbar>
  );
}
