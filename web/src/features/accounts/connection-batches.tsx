import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

type Account = components["schemas"]["Account"];
type ImportBatch = components["schemas"]["ImportBatch"];

interface ConnectionBatchesProps {
  batches: ImportBatch[];
  accounts: Map<string, Account>;
}

export function ConnectionBatches({
  batches,
  accounts,
}: ConnectionBatchesProps) {
  const t = useT();

  if (batches.length === 0) {
    return null;
  }

  return (
    <Stack gap={1}>
      <Text size="sm" tone="muted">
        {t("links.batches")}
      </Text>
      {batches.map((batch) => (
        <Text size="sm" key={batch.id}>
          <Link
            variant="neutral"
            underline="hover"
            render={routeTo({
              to: "/accounts/$id/imports/$batchId",
              params: { id: batch.account_id, batchId: batch.id },
            })}
          >
            {t("links.batch", {
              account: accounts.get(batch.account_id)?.name ?? "",
            })}
          </Link>
        </Text>
      ))}
    </Stack>
  );
}
