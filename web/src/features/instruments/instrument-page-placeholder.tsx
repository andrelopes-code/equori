import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Link } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/page-back";

// A223: the page of an instrument while it loads. The way back is chrome and stays real; the
// heading, the holdings, the price chart and the facts are reserved at the size they take.
export function InstrumentPagePlaceholder() {
  const t = useT();

  return (
    <Page width="full" loading>
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack render={(props) => <Link {...props} to="/instruments" />}>
            {t("nav.instruments")}
          </PageBack>

          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <Skeleton shape="text" inlineSize="16rem" />
              <Skeleton shape="text" inlineSize="9rem" />
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>

      <PageBody>
        <SkeletonRegion>
          <Stack gap={6}>
            <Skeleton shape="block" blockSize="6rem" />
            <Skeleton shape="block" blockSize="20rem" />
            <Skeleton shape="block" blockSize="8rem" />
          </Stack>
        </SkeletonRegion>
      </PageBody>
    </Page>
  );
}
