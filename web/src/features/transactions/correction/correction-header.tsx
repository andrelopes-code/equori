import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Link } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { HelpLink } from "@/features/help";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";
import { useMediaQuery, wideQuery } from "@/ui/runtime/use-media-query";

type Transaction = components["schemas"]["Transaction"];

interface CorrectionHeaderProps {
  transaction: Transaction;
  // The version the correction starts from: the form's own after a conflict.
  version: number;
}

// The header of every correction: the way back to the transaction, its date and version, and
// the help page of the task.
export function CorrectionHeader({
  transaction,
  version,
}: CorrectionHeaderProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const wide = useMediaQuery(wideQuery);

  return (
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
                version: version,
              })}
            </PageHeaderSubheading>
          </PageHeaderTitle>

          <PageHeaderActions>
            <HelpLink page="correct-transaction" />
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
