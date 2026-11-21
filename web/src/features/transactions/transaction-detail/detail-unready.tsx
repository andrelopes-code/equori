import { Button } from "@slotted/react/button";
import { DetailPanel, DetailPanelBody } from "@slotted/react/detail-panel";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import type { ReactNode } from "react";

import { ProblemError, errorText } from "@/api/problem";
import { DetailPlaceholder } from "@/features/transactions/transaction-detail/detail-placeholder";
import type { TransactionData } from "@/features/transactions/transaction-detail/use-transaction-data";
import { useT } from "@/i18n/i18n-provider";

interface DetailUnreadyProps {
  data: Exclude<TransactionData, { status: "ready" }>;
  host: "page" | "pane";
  // The page below 600 px, which draws the receipt's shape while it loads.
  phone: boolean;
  back: ReactNode;
  close: ReactNode;
}

// The detail before its transaction is there: loading, missing or failed.
export function DetailUnready({
  data,
  host,
  phone,
  back,
  close,
}: DetailUnreadyProps) {
  const t = useT();

  const loading = data.status === "loading";
  const notFound =
    data.status === "error" &&
    data.error instanceof ProblemError &&
    data.error.status === 404;

  return (
    <DetailPanel
      level={host === "page" ? "1" : "2"}
      scroll={host === "pane" ? "self" : "ancestor"}
      aside={phone ? "none" : undefined}
      loading={loading && !phone}
      status={
        data.status === "error" ? (notFound ? "not-found" : "error") : "ready"
      }
    >
      <PageHeader loading={loading}>
        <PageHeaderTitleArea>
          {back}
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("detail.title")}</PageHeaderHeading>
            </PageHeaderTitle>
            {close !== null && <PageHeaderActions>{close}</PageHeaderActions>}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>

      <DetailPanelBody
        aria-busy={loading}
        message={
          data.status === "error" ? (
            <ResultState status={notFound ? "not-found" : "error"}>
              <ResultStateContent>
                <ResultStateTitle>
                  {notFound ? t("detail.notFound") : t("detail.loadFailed")}
                </ResultStateTitle>
                <ResultStateDescription>
                  {notFound
                    ? t("detail.notFoundHint")
                    : errorText(data.error, t)}
                </ResultStateDescription>
              </ResultStateContent>
              {!notFound && (
                <ResultStateActions>
                  <Button
                    variant="outline"
                    tone="secondary"
                    onClick={data.retry}
                  >
                    {t("transactions.tryAgain")}
                  </Button>
                </ResultStateActions>
              )}
            </ResultState>
          ) : undefined
        }
      >
        {loading && phone && <DetailPlaceholder />}
      </DetailPanelBody>
    </DetailPanel>
  );
}
