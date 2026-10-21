import { Link as SlottedLink } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { transactionQuery } from "@/features/transactions/api";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];
type LinkType = components["schemas"]["Link"]["type"];

// The words read from this transaction toward the other one, both ways.
const outbound: Record<LinkType, MessageKey> = {
  refund_of: "links.out.refund_of",
  reimbursement_of: "links.out.reimbursement_of",
  cancellation_of: "links.out.cancellation_of",
  anticipation_of: "links.out.anticipation_of",
  chargeback_of: "links.out.chargeback_of",
  correction_of: "links.out.correction_of",
};

const inbound: Record<LinkType, MessageKey> = {
  refund_of: "links.in.refund_of",
  reimbursement_of: "links.in.reimbursement_of",
  cancellation_of: "links.in.cancellation_of",
  anticipation_of: "links.in.anticipation_of",
  chargeback_of: "links.in.chargeback_of",
  correction_of: "links.in.correction_of",
};

export function LinksSection({ transaction }: { transaction: Transaction }) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const navigate = useNavigate();
  const entries = [
    ...transaction.links.map((l) => ({
      id: l.target,
      words: outbound[l.type],
    })),
    ...(transaction.referenced_by ?? []).map((l) => ({
      id: l.source,
      words: inbound[l.type],
    })),
  ];
  const linked = useQueries({
    queries: entries.map((e) => transactionQuery(api, e.id)),
  });
  return (
    <Stack gap={2}>
      {entries.map((entry, index) => {
        const other = linked[index]?.data;
        const name =
          other === undefined
            ? t("links.loading")
            : `${other.description || t("transactions.untitled")} · ${formatDate(other.date, locale)}`;
        return (
          <Text key={`${entry.words}-${entry.id}`}>
            {t(entry.words)}{" "}
            <SlottedLink
              href={`/transactions/${entry.id}`}
              onClick={(event) => {
                // A plain press stays in the app; a modified press opens the address as the platform does.
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                void navigate({
                  to: "/transactions/$id",
                  params: { id: entry.id },
                });
              }}
            >
              {name}
            </SlottedLink>
          </Text>
        );
      })}
    </Stack>
  );
}
