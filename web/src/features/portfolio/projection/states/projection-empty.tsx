import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";

interface ProjectionEmptyProps {
  onBuild: () => void;
}

// PX11: no plan; the action opens the plan section with the fields at rest.
export function ProjectionEmpty({ onBuild }: ProjectionEmptyProps) {
  const t = useT();

  return (
    <ResultState status="empty" reach="section">
      <ResultStateContent>
        <ResultStateTitle>
          {t("portfolio.projection.empty.title")}
        </ResultStateTitle>
        <ResultStateDescription>
          {t("portfolio.projection.empty.description")}
        </ResultStateDescription>
      </ResultStateContent>

      <ResultStateActions>
        <Button variant="outline" tone="secondary" onClick={onBuild}>
          {t("portfolio.projection.empty.build")}
        </Button>
      </ResultStateActions>
    </ResultState>
  );
}
