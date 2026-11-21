import { ContainerBreakout } from "@slotted/react/container";
import { Page, PageBody } from "@slotted/react/page";
import { useParams } from "@tanstack/react-router";

import { TransactionDetail } from "@/features/transactions/transaction-detail/transaction-detail";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

export function TransactionPage() {
  const { id } = useParams({ from: "/_authed/transactions/$id" });
  const compact = useMediaQuery(compactQuery);

  // Workaround for Slotted issue #167: a level-1 detail panel inside PageBody adds its own inset
  // to the page's. Below 600 px it breaks out of the page column, so its header's rule spans the
  // screen and its own containers keep the one margin (spec 2026-11-21-mobile-transaction-detail,
  // MD1).
  return (
    <Page width="full">
      <PageBody>
        {compact && (
          <ContainerBreakout>
            <TransactionDetail id={id} host="page" />
          </ContainerBreakout>
        )}

        {!compact && <TransactionDetail id={id} host="page" />}
      </PageBody>
    </Page>
  );
}
