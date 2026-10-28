import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";
import { useMoneyFormat } from "@/privacy/use-money-format";

type ExternalRecord = components["schemas"]["ExternalRecord"];

// The lines waiting for review; each row is the address of its line (WS-01).
export function ReviewQueue({
  accountId,
  batchId,
  records,
  current,
  scale,
}: {
  accountId: string;
  batchId: string;
  records: ExternalRecord[];
  current: string | undefined;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  return (
    <List aria-label={t("batch.queue")} variant="framed">
      {records.map((record) => (
        <ListItem key={record.id} current={record.id === current}>
          <ListItemLink
            render={routeTo({
              to: "/accounts/$id/imports/$batchId",
              params: { id: accountId, batchId },
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                record: record.id,
              }),
            })}
          >
            <ListItemBody>
              <ListItemLabel>
                {record.description === ""
                  ? t("ledger.untitled")
                  : record.description}
              </ListItemLabel>
              <ListItemDescription>
                {formatDate(record.date, locale)}
              </ListItemDescription>
            </ListItemBody>
            <ListItemEnd>
              {fmt.signed(record.amount, scale(record.amount.currency))}
            </ListItemEnd>
          </ListItemLink>
        </ListItem>
      ))}
    </List>
  );
}
