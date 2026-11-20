import type { components } from "@/api/schema.gen";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { DiffRows } from "@/features/assistant/proposal/bodies/diff-rows";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface MoveBodyProps {
  preview: Preview;
}

// Units that move between two accounts, as custody does: from the account they leave, what moves,
// to the account they reach; the cost basis travels with them.
export function MoveBody({ preview }: MoveBodyProps) {
  const t = useT();
  const valueText = useValueText();

  // The preview names the holding as its target and the brokerage it moves to as the account.
  const account = changeOf(preview, "account");
  const from = valueText(account?.before) ?? preview.target;
  const to = valueText(account?.after);
  const what = valueText(changeOf(preview, "quantity")?.after);
  const rest = changesWithout(preview, ["account", "quantity"]);

  if (from === undefined || to === undefined)
    return <DiffRows changes={preview.changes} />;

  return (
    <div className={styles.body}>
      <div className={styles.moveFlow}>
        <span className={styles.moveNode}>
          <small>{t("assistantView.write.from")}</small>
          {from}
        </span>
        <span className={styles.diffArrow} aria-hidden="true">
          <AssistantIcon name="link" />
        </span>
        <span className={styles.moveNodeHot}>
          <small>{t("assistantView.write.quantity")}</small>
          {what}
        </span>
        <span className={styles.diffArrow} aria-hidden="true">
          <AssistantIcon name="link" />
        </span>
        <span className={styles.moveNode}>
          <small>{t("assistantView.write.to")}</small>
          {to}
        </span>
      </div>

      <DiffRows changes={rest} />
    </div>
  );
}
