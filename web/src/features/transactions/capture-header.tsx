import { ButtonLink } from "@slotted/react/button";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { meQuery } from "@/features/session";
import { readQueue } from "@/features/transactions/capture-queue";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/page-back";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

interface CaptureHeaderProps {
  // The day a text of the offline queue was written; undefined for the session's draft.
  queuedOn: string | undefined;
}

export function CaptureHeader({ queuedOn }: CaptureHeaderProps) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const wide = useMediaQuery(wideQuery);
  const me = useQuery({ ...meQuery(api), staleTime: Infinity });

  const waiting = me.data === undefined ? 0 : readQueue(me.data.id).length;
  const description =
    queuedOn === undefined
      ? t("capture.subheading")
      : t("capture.queuedFrom", { date: formatDate(queuedOn, locale) });

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        {/* Below 1024 px the shell's top app bar carries the way back. */}
        {wide && (
          <PageBack render={(props) => <Link {...props} to="/transactions" />}>
            {t("nav.transactions")}
          </PageBack>
        )}

        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("capture.title")}</PageHeaderHeading>
          </PageHeaderTitle>

          <PageHeaderActions>
            <ButtonLink
              variant="outline"
              tone="secondary"
              render={(props) => <Link {...props} to="/transactions/new" />}
            >
              {t("capture.useForm")}
            </ButtonLink>

            {queuedOn === undefined && waiting > 0 && (
              <ButtonLink
                variant="outline"
                tone="secondary"
                render={(props) => <Link {...props} to="/transactions/queue" />}
              >
                {t("capture.queue", { count: waiting })}
              </ButtonLink>
            )}
          </PageHeaderActions>
        </PageHeaderTitleRow>

        <PageHeaderDescription>{description}</PageHeaderDescription>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
