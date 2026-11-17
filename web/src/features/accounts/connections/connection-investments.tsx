import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { connectionInvestmentsQuery } from "@/features/accounts/api";
import { ConfirmApplicationDialog } from "@/features/accounts/connections/confirm-application-dialog";
import { ConfirmIncomeDialog } from "@/features/accounts/connections/confirm-income-dialog";
import { InvestmentMovementRow } from "@/features/accounts/connections/investment-movement-row";
import { useInvestmentReview } from "@/features/accounts/connections/use-investment-review";
import { useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/dialogs/presence";
import { FormNotice } from "@/ui/form-layout/form-notice";

type Connection = components["schemas"]["Connection"];

interface ConnectionInvestmentsProps {
  connection: Connection;
}

// A236: the movements of the investments a connection reads, each to confirm or dismiss.
export function ConnectionInvestments({
  connection,
}: ConnectionInvestmentsProps) {
  const t = useT();
  const api = useApi();
  const investments = useQuery(connectionInvestmentsQuery(api, connection.id));
  const review = useInvestmentReview();

  const rows = (investments.data?.investments ?? [])
    .flatMap((i) => i.movements.map((movement) => ({ name: i.name, movement })))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.movement.date.localeCompare(b.movement.date),
    );

  if (rows.length === 0) {
    return null;
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("connection.investments")}</SectionHeading>
          <SectionDescription>
            {t("connection.investments.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        {review.error !== null && <FormNotice>{review.error}</FormNotice>}

        <ul>
          {rows.map(({ name, movement }) => (
            <InvestmentMovementRow
              key={movement.id}
              movement={movement}
              name={name}
              disabled={review.pending}
              onConfirm={review.handleConfirm}
              onDismiss={review.handleDismiss}
              onUndo={review.handleUndo}
            />
          ))}
        </ul>

        <Presence
          value={
            review.dialog?.kind === "application" ? review.dialog : undefined
          }
        >
          {({ movement }) => (
            <ConfirmApplicationDialog
              movement={movement}
              onConfirm={(brokerageId) => {
                review.handleSubmit(movement, { brokerage_id: brokerageId });
              }}
              onCancel={review.handleCloseDialog}
            />
          )}
        </Presence>

        <Presence
          value={review.dialog?.kind === "income" ? review.dialog : undefined}
        >
          {({ movement }) => (
            <ConfirmIncomeDialog
              onConfirm={(categoryId) => {
                review.handleSubmit(movement, { category_id: categoryId });
              }}
              onCancel={review.handleCloseDialog}
            />
          )}
        </Presence>
      </SectionBody>
    </Section>
  );
}
