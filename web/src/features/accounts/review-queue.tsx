import { Checkbox } from "@slotted/react/checkbox";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";

import type { components } from "@/api/schema.gen";
import { isSelectable } from "@/features/accounts/review-selection";
import type { ReviewSelection } from "@/features/accounts/use-review-selection";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { routeTo } from "@/ui/route-to";

type ExternalRecord = components["schemas"]["ExternalRecord"];

interface ReviewQueueProps {
  accountId: string;
  batchId: string;
  records: ExternalRecord[];
  current: string | undefined;
  scale: (code: string) => number;
  selection: ReviewSelection;
}

// The lines waiting for review; each row is the address of its line (WS-01).
export function ReviewQueue({
  accountId,
  batchId,
  records,
  current,
  scale,
  selection,
}: ReviewQueueProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const all = selection.selected.length === selection.selectableCount;
  const some = selection.selected.length > 0;

  return (
    <div>
      {selection.selectableCount > 0 && (
        <Checkbox
          checked={all && some}
          indeterminate={some && !all}
          onCheckedChange={selection.toggleAll}
        >
          {t("reviewSelection.selectAll", { count: selection.selectableCount })}
        </Checkbox>
      )}

      <List aria-label={t("batch.queue")} variant="framed">
        {records.map((record) => (
          <ListItem
            key={record.id}
            current={record.id === current}
            selected={selection.selected.includes(record.id)}
          >
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
            {isSelectable(record) && (
              <ListItemActions>
                {/* Workaround for Slotted issue #79: a link row has no leading place for its checkbox. */}
                <Checkbox
                  aria-label={t("reviewSelection.select", {
                    line:
                      record.description === ""
                        ? t("ledger.untitled")
                        : record.description,
                  })}
                  checked={selection.selected.includes(record.id)}
                  onCheckedChange={() => {
                    selection.toggle(record.id);
                  }}
                />
              </ListItemActions>
            )}
          </ListItem>
        ))}
      </List>
    </div>
  );
}
