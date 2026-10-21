import { Page, PageBody } from "@slotted/react/page";
import { useParams } from "@tanstack/react-router";

import { TransactionDetail } from "@/features/transactions/transaction-detail";

export function TransactionPage() {
  const { id } = useParams({ from: "/_authed/transactions/$id" });
  return (
    <Page width="full">
      <PageBody>
        <TransactionDetail id={id} host="page" />
      </PageBody>
    </Page>
  );
}
