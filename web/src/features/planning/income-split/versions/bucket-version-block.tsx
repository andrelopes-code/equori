import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Divider } from "@slotted/react/divider";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { BucketVersionMenu } from "@/features/planning/income-split/versions/bucket-version-menu";
import { BucketVersionDelete } from "@/features/planning/income-split/versions/bucket-version-delete";
import { versionChanges } from "@/features/planning/income-split/versions/bucket-version-changes";
import { BucketVersionRow } from "@/features/planning/income-split/versions/bucket-version-row";
import { useMonthNames } from "@/features/planning/income-split/use-month-names";
import { useT } from "@/i18n/i18n-provider";

type Version = components["schemas"]["BudgetBucketVersion"];

interface BucketVersionBlockProps {
  versions: readonly Version[];
  version: Version;
  // The version before this one; undefined for the first.
  prev: Version | undefined;
  // This version is the method of the month on screen.
  inForce: boolean;
  categories: readonly CategoryEntry[];
  onEdit: () => void;
}

const lineKinds = ["removed", "moved", "started", "ended"];
const separator = "·";

// One version: its start, its buckets with their shares and what changed against the version
// before.
export function BucketVersionBlock({
  versions,
  version,
  prev,
  inForce,
  categories,
  onEdit,
}: BucketVersionBlockProps) {
  const t = useT();
  const names = useMonthNames([]);
  const [deleting, setDeleting] = useState(false);

  const first = prev === undefined;
  const changes = versionChanges(prev, version);
  const lines = changes.filter((c) => lineKinds.includes(c.kind));
  const none = !first && changes.length === 0;
  const title = first
    ? t("buckets.version.start")
    : t("buckets.version.since", { month: names.longYear(version.from) });

  return (
    <Card size="sm">
      <CardHeader>
        <Inline gap={2} align="baseline" wrap="nowrap">
          <Text size="md" weight="medium">
            {title}
          </Text>
          {inForce && (
            <Text size="sm" tone="muted" aria-hidden>
              {separator}
            </Text>
          )}
          {inForce && (
            <Text size="sm" tone="muted">
              {t("buckets.version.inForce")}
            </Text>
          )}
        </Inline>

        {!deleting && (
          <CardActions>
            <BucketVersionMenu
              onEdit={onEdit}
              onDelete={() => {
                setDeleting(true);
              }}
            />
          </CardActions>
        )}
      </CardHeader>

      <Divider decorative />

      <CardBody>
        <Stack gap={2}>
          {deleting && (
            <BucketVersionDelete
              versions={versions}
              from={version.from}
              onKeep={() => {
                setDeleting(false);
              }}
            />
          )}

          {version.buckets.map((bucket) => (
            <BucketVersionRow
              key={bucket.id}
              bucket={bucket}
              changes={changes}
              categories={categories}
            />
          ))}
          {lines.map((change, i) => (
            <BucketVersionRow
              key={`${change.kind}-${String(i)}`}
              change={change}
              categories={categories}
            />
          ))}
          {none && <BucketVersionRow categories={categories} />}
        </Stack>
      </CardBody>
    </Card>
  );
}
