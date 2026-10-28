import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Link } from "@tanstack/react-router";

import { useMediaQuery, wideQuery } from "@/ui/use-media-query";
import { PageBack } from "@/ui/page-back";

// FM-01: the form stands on its own route, and the way back is the header's back part.
export function AccountFormHeader({
  title,
  subtitle,
  back,
  backLabel,
}: {
  title: string;
  subtitle: string;
  back:
    | { to: "/accounts" }
    | { to: "/accounts/$id"; params: { id: string } }
    | { to: "/cards/$accountId"; params: { accountId: string } };
  backLabel: string;
}) {
  const wide = useMediaQuery(wideQuery);
  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        {/* Below 1024 px the shell's top app bar carries the way back. */}
        {wide && (
          <PageBack render={(props) => <Link {...props} {...back} />}>
            {backLabel}
          </PageBack>
        )}
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{title}</PageHeaderHeading>
            <PageHeaderSubheading>{subtitle}</PageHeaderSubheading>
          </PageHeaderTitle>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
