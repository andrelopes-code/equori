import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { PageBack } from "@/ui/navigation/page-back";
import { useMediaQuery, wideQuery } from "@/ui/runtime/use-media-query";

type Transaction = components["schemas"]["Transaction"];

interface CorrectionPageProps {
  transaction: Transaction;
  pending: boolean;
  summary: string | null;
  onSave: () => void;
  children: ReactNode;
}

// The page of a correction drawn from the order of a trade or an income (A227 IC9).
export function CorrectionPage({
  transaction,
  pending,
  summary,
  onSave,
  children,
}: CorrectionPageProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const wide = useMediaQuery(wideQuery);

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("entry.actions")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    void navigate({
                      to: "/transactions/$id",
                      params: { id: transaction.id },
                    });
                  }}
                >
                  {t("detail.cancel")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button loading={pending} onClick={onSave}>
                  {t("correct.save")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          {wide && (
            <PageBack
              render={(props) => (
                <Link
                  {...props}
                  to="/transactions/$id"
                  params={{ id: transaction.id }}
                />
              )}
            >
              {transaction.description || t("detail.title")}
            </PageBack>
          )}
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("correct.title")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("correct.subtitle", {
                  date: formatDate(transaction.date, locale),
                  version: transaction.version,
                })}
              </PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>

      <PageBody>
        <Stack gap={5}>
          {summary !== null && <FormNotice>{summary}</FormNotice>}
          {children}
        </Stack>
      </PageBody>
    </Page>
  );
}
