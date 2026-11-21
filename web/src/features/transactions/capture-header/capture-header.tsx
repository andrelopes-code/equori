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
import { Link, useNavigate } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { HelpLink } from "@/features/help";
import { meQuery } from "@/features/session";
import { readQueue } from "@/features/transactions/capture-model/capture-queue";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";
import { HeaderToolbar } from "@/ui/page-layout/header-toolbar";
import type { HeaderToolbarAction } from "@/ui/page-layout/header-toolbar";
import {
  compactQuery,
  useMediaQuery,
  wideQuery,
} from "@/ui/runtime/use-media-query";

interface CaptureHeaderProps {
  // The day a text of the offline queue was written; undefined for the session's draft.
  queuedOn: string | undefined;
}

export function CaptureHeader({ queuedOn }: CaptureHeaderProps) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const wide = useMediaQuery(wideQuery);
  const compact = useMediaQuery(compactQuery);
  const navigate = useNavigate();
  const me = useQuery({ ...meQuery(api), staleTime: Infinity });

  const waiting = me.data === undefined ? 0 : readQueue(me.data.id).length;
  const description =
    queuedOn === undefined
      ? t("capture.subheading")
      : t("capture.queuedFrom", { date: formatDate(queuedOn, locale) });
  const form: HeaderToolbarAction = {
    id: "form",
    label: t("capture.useForm"),
    onSelect: () => {
      void navigate({ to: "/transactions/new" });
    },
    control: (
      <ButtonLink
        variant="outline"
        tone="secondary"
        render={(props) => <Link {...props} to="/transactions/new" />}
      >
        {t("capture.useForm")}
      </ButtonLink>
    ),
  };
  const queue: HeaderToolbarAction = {
    id: "queue",
    label: t("capture.queue", { count: waiting }),
    onSelect: () => {
      void navigate({ to: "/transactions/queue" });
    },
    control: (
      <ButtonLink
        variant="outline"
        tone="secondary"
        render={(props) => <Link {...props} to="/transactions/queue" />}
      >
        {t("capture.queue", { count: waiting })}
      </ButtonLink>
    ),
  };

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
            <HeaderToolbar
              pinned={<HelpLink page="text-capture" />}
              actions={
                queuedOn === undefined && waiting > 0 ? [form, queue] : [form]
              }
            />
          </PageHeaderActions>
        </PageHeaderTitleRow>

        {/* On a phone the general sentence leaves; the day of a queued text stays (spec
            2026-11-21-mobile-entry-forms, MF3). */}
        {(!compact || queuedOn !== undefined) && (
          <PageHeaderDescription>{description}</PageHeaderDescription>
        )}
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
