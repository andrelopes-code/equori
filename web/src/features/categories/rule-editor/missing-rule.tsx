import { Page, PageBody } from "@slotted/react/page";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";

export function MissingRule() {
  const t = useT();
  return (
    <Page width="full">
      <PageBody>
        <ResultState status="not-found">
          <ResultStateContent>
            <ResultStateTitle>{t("ruleEditor.notFound")}</ResultStateTitle>
          </ResultStateContent>
        </ResultState>
      </PageBody>
    </Page>
  );
}
