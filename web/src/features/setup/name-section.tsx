import { Button } from "@slotted/react/button";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { useState } from "react";

import styles from "@/features/setup/name-section.module.css";
import { NameDialog } from "@/features/setup/name-dialog";
import type { NamedKind } from "@/features/setup/name-dialog";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

interface Named {
  id: string;
  name: string;
}

export function NameSection({
  kind,
  items,
  error,
  onRetry,
  create,
}: {
  kind: NamedKind;
  items: Named[] | undefined;
  error: Error | null;
  onRetry: () => void;
  create: (name: string) => Promise<unknown>;
}) {
  const t = useT();
  const [creating, setCreating] = useState(false);

  let body;
  if (error !== null) {
    body = <QueryError error={error} onRetry={onRetry} />;
  } else if (items === undefined) {
    body = (
      <SkeletonRegion>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} shape="text" inlineSize="60%" />
        ))}
      </SkeletonRegion>
    );
  } else if (items.length === 0) {
    body = <p className={styles.empty}>{t(`settings.${kind}.empty`)}</p>;
  } else {
    body = (
      <ul aria-label={t(`settings.${kind}.title`)} className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            {item.name}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t(`settings.${kind}.title`)}</SectionHeading>
        </SectionTitle>
        <SectionActions>
          {items !== undefined && (
            <span className={styles.count}>{items.length}</span>
          )}
          <Button
            tone="secondary"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreating(true);
            }}
          >
            {t(`settings.${kind}.new`)}
          </Button>
        </SectionActions>
      </SectionHeader>
      <SectionBody>{body}</SectionBody>
      {creating && (
        <NameDialog
          kind={kind}
          create={create}
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </Section>
  );
}
