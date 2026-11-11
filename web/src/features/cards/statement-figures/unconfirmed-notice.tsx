import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { unconfirmedQuery } from "@/features/accounts";
import { useT } from "@/i18n/i18n-provider";

type StatementDetail = components["schemas"]["StatementDetail"];

export interface UnconfirmedNoticeProps {
  statement: StatementDetail;
}

// A133: the lines of the statement the bank has not reported, why they are listed and what
// settles them. A statement whose total matches the bank's is settled by reconciling it.
export function UnconfirmedNotice({ statement }: UnconfirmedNoticeProps) {
  const t = useT();
  const api = useApi();
  const unconfirmed = useQuery(unconfirmedQuery(api, statement.account_id));

  const entries = (unconfirmed.data ?? []).filter(
    (e) => e.statement_id === statement.id,
  );
  if (entries.length === 0 || statement.reconciled) return null;

  const names = entries.map((e) => e.description).join(", ");
  const matches =
    statement.institution !== undefined &&
    statement.amount_difference?.amount === 0;

  return (
    <Alert tone="info">
      <AlertContent>
        <AlertTitle>{t("statement.unconfirmedTitle", { names })}</AlertTitle>
        <AlertDescription>
          {matches
            ? t("statement.unconfirmedMatches")
            : t("statement.unconfirmedHelp")}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
