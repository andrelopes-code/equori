import { Text } from "@slotted/react/typography";
import type { KeyboardEvent } from "react";

import styles from "@/features/accounts/kind-chooser/kind-chooser.module.css";
import { kindCountText } from "@/features/accounts/kind-chooser/kind-count-text";
import { KindScene } from "@/features/accounts/kind-chooser/kind-scene";
import { kindTitle, type Kind } from "@/features/accounts/model/account-kinds";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface KindTileProps {
  kind: Kind;
  checked: boolean;
  tabbable: boolean;
  count: number;
  onChoose: (kind: Kind) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, kind: Kind) => void;
}

// KC2: a radio with the kind's scene above one row of 40 px: the title and, end-aligned, the count.
export function KindTile({
  kind,
  checked,
  tabbable,
  count,
  onChoose,
  onKeyDown,
}: KindTileProps) {
  const t = useT();
  const [tag] = useAppLocale();

  return (
    <button
      className={styles.tile}
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={tabbable ? 0 : -1}
      data-kind={kind}
      onClick={() => {
        onChoose(kind);
      }}
      onKeyDown={(event) => {
        onKeyDown(event, kind);
      }}
    >
      <KindScene kind={kind} />

      <span className={styles.meta}>
        <Text
          size="sm"
          weight="semibold"
          wrap="nowrap"
          className={styles.title}
        >
          {t(kindTitle[kind])}
        </Text>
        {count > 0 && (
          <Text size="sm" tone="muted" numeric="tabular" wrap="nowrap">
            {kindCountText(t, tag, count, kind)}
          </Text>
        )}
      </span>
    </button>
  );
}
