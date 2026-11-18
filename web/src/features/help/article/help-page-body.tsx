import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { HelpArticle } from "@/features/help/article/help-article";
import type { HelpDocument } from "@/features/help/model/parse-help-page";
import { useT } from "@/i18n/i18n-provider";

interface HelpPageBodyProps {
  document: HelpDocument | null;
  missing: boolean;
  failed: boolean;
  page: string;
  onRetry: () => void;
}

// The page's text, or what stands in its place when it is missing or failed to load.
export function HelpPageBody({
  document,
  missing,
  failed,
  page,
  onRetry,
}: HelpPageBodyProps) {
  const t = useT();

  if (document !== null) {
    return <HelpArticle document={document} page={page} />;
  }

  if (missing) {
    return (
      <ResultState status="not-found">
        <ResultStateContent>
          <ResultStateTitle>{t("help.notFound")}</ResultStateTitle>
          <ResultStateDescription>
            {t("help.notFoundHint")}
          </ResultStateDescription>
        </ResultStateContent>
      </ResultState>
    );
  }

  if (!failed) return null;

  return (
    <ResultState status="error">
      <ResultStateContent>
        <ResultStateTitle>{t("help.loadFailed")}</ResultStateTitle>
      </ResultStateContent>
      <ResultStateActions>
        <Button variant="outline" tone="secondary" onClick={onRetry}>
          {t("transactions.tryAgain")}
        </Button>
      </ResultStateActions>
    </ResultState>
  );
}
