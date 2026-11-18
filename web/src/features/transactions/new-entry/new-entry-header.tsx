import { ButtonLink } from "@slotted/react/button";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Link } from "@tanstack/react-router";

import { HelpLink } from "@/features/help";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";
import { useMediaQuery, wideQuery } from "@/ui/runtime/use-media-query";

export function NewEntryHeader() {
  const t = useT();
  const wide = useMediaQuery(wideQuery);

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
            <PageHeaderHeading>{t("nav.new")}</PageHeaderHeading>
          </PageHeaderTitle>

          <PageHeaderActions>
            <HelpLink page="record-transaction" />
            <ButtonLink
              variant="outline"
              tone="secondary"
              render={(props) => <Link {...props} to="/transactions/capture" />}
            >
              {t("capture.useText")}
            </ButtonLink>
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
