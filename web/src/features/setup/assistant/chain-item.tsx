import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import type {
  ChainTargetInput,
  ModelUse,
  UsageRow,
} from "@/features/setup/api";
import styles from "@/features/setup/assistant/chain-dialog.module.css";
import { ChainItemMenu } from "@/features/setup/assistant/chain-item-menu";
import { resting } from "@/features/setup/assistant/use-answer";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface ChainItemProps {
  use: ModelUse;
  target: ChainTargetInput;
  provider: string;
  position: number;
  last: boolean;
  rows: readonly UsageRow[];
  now: Date;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}

// One target of the chain being edited (spec A9): its position, the model over its provider and
// condition, and the actions that move or remove it. A phone holds the actions in one menu.
export function ChainItem({
  use,
  target,
  provider,
  position,
  last,
  rows,
  now,
  onUp,
  onDown,
  onRemove,
}: ChainItemProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const missing = use.needs
    .filter((need) => !(target.capabilities ?? []).includes(need))
    .map((need) => t(`assistant.capability.${need}`))
    .join(", ");
  const rest = resting(target, rows, now);
  const first = position === 1;
  const condition = conditionText();

  function conditionText() {
    if (missing !== "")
      return t("assistant.chain.ignored", { provider, list: missing });

    if (rest === null) return provider;

    if (rest.until === undefined)
      return t("assistant.chain.reachedAt", { provider });

    return t("assistant.chain.pausedAt", {
      provider,
      time: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(rest.until)),
    });
  }

  return (
    <li className={styles.item}>
      <Text
        size="xs"
        weight="semibold"
        tone="muted"
        numeric="tabular"
        align="center"
      >
        {position}
      </Text>

      <div className={styles.text}>
        <Text size="sm" truncate className={styles.mono}>
          {target.model}
        </Text>
        <Text
          size="sm"
          tone={missing === "" ? "muted" : "danger"}
          truncate
          className={styles.desk}
        >
          {condition}
        </Text>
        <Text
          size="sm"
          tone={missing === "" ? "muted" : "danger"}
          truncate
          className={styles.phone}
        >
          {missing === ""
            ? condition
            : t("assistant.chain.ignored.short", { list: missing })}
        </Text>
      </div>

      <div className={cx(styles.actions, styles.desk)}>
        <IconButton
          variant="ghost"
          tone="secondary"
          disabled={first}
          aria-label={t("assistant.chain.upOf", { model: target.model })}
          onClick={onUp}
        >
          <Icon>
            <Glyph name="chevron-up" />
          </Icon>
        </IconButton>
        <IconButton
          variant="ghost"
          tone="secondary"
          disabled={last}
          aria-label={t("assistant.chain.downOf", { model: target.model })}
          onClick={onDown}
        >
          <Icon>
            <Glyph name="chevron-down" />
          </Icon>
        </IconButton>
        <IconButton
          variant="ghost"
          tone="secondary"
          aria-label={t("assistant.chain.removeOf", { model: target.model })}
          onClick={onRemove}
        >
          <Icon>
            <Glyph name="x" />
          </Icon>
        </IconButton>
      </div>

      <div className={cx(styles.actions, styles.phone)}>
        <ChainItemMenu
          model={target.model}
          first={first}
          last={last}
          onUp={onUp}
          onDown={onDown}
          onRemove={onRemove}
        />
      </div>
    </li>
  );
}
