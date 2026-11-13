import { Text } from "@slotted/react/typography";
import { useId, useRef, type KeyboardEvent } from "react";

import styles from "@/features/accounts/kind-chooser/kind-chooser.module.css";
import {
  kindOrder,
  nextKind,
} from "@/features/accounts/kind-chooser/kind-order";
import { KindTile } from "@/features/accounts/kind-chooser/kind-tile";
import { classOf, type Kind } from "@/features/accounts/model/account-kinds";
import { useT } from "@/i18n/i18n-provider";

interface KindChooserProps {
  value: Kind | null;
  counts: Record<Kind, number>;
  onChange: (kind: Kind) => void;
  onContinue: () => void;
}

// Workaround for Slotted issue #101: RadioGroup variant="tile" draws a mark and a label with a
// description and has no slot for an illustration and no way to hide the mark, so the gallery of
// KC1 to KC4 is a radiogroup of the app's own. Families read: RadioGroup, Card, Section.
export function KindChooser({
  value,
  counts,
  onChange,
  onContinue,
}: KindChooserProps) {
  const t = useT();
  const id = useId();
  const group = useRef<HTMLDivElement>(null);
  const sides = [
    {
      side: "asset",
      title: t("kindChooser.assets"),
      note: t("kindChooser.assetsNote"),
    },
    {
      side: "liability",
      title: t("kindChooser.liabilities"),
      note: t("kindChooser.liabilitiesNote"),
    },
  ] as const;
  const first = kindOrder[0];

  function handleChoose(kind: Kind) {
    if (kind === value) return;

    const tile = group.current?.querySelector(`[data-kind="${kind}"]`);

    onChange(kind);
    (tile as HTMLElement | null)?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, kind: Kind) {
    if (event.key === "Enter" && kind === value) {
      event.preventDefault();
      onContinue();

      return;
    }

    const next = nextKind(value, event.key);

    if (next === null) return;

    event.preventDefault();
    handleChoose(next);
  }

  return (
    <div
      ref={group}
      className={styles.chooser}
      role="radiogroup"
      aria-label={t("kindChooser.label")}
    >
      {sides.map(({ side, title, note }) => (
        <div
          key={side}
          className={styles.side}
          role="group"
          aria-labelledby={`${id}-${side}`}
        >
          <div className={styles.head}>
            <Text id={`${id}-${side}`} size="md" weight="semibold">
              {title}
            </Text>
            <Text size="sm" tone="muted">
              {note}
            </Text>
          </div>

          <div className={styles.gallery}>
            {kindOrder
              .filter((kind) => classOf(kind) === side)
              .map((kind) => (
                <KindTile
                  key={kind}
                  kind={kind}
                  checked={kind === value}
                  tabbable={value === null ? kind === first : kind === value}
                  count={counts[kind]}
                  onChoose={handleChoose}
                  onKeyDown={handleKeyDown}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
