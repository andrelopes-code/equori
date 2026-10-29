import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { HelpArticle } from "@/features/help/help-article";
import type { HelpText } from "@/features/help/help-pages";
import { useT } from "@/i18n/i18n-provider";

interface HelpPageBodyProps {
  text: HelpText | null;
  missing: boolean;
  failed: boolean;
  page: string;
  onRetry: () => void;
}

// The page's text, or what stands in its place when it is missing or failed to load.
export function HelpPageBody({
  text,
  missing,
  failed,
  page,
  onRetry,
}: HelpPageBodyProps) {
  const t = useT();

  if (text !== null) {
    return (
      <HelpArticle lead={text.leadMarkdown} body={text.body} page={page} />
    );
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
