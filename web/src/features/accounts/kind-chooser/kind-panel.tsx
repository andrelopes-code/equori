import { Heading, Text } from "@slotted/react/typography";

import { KindPanelEmpty } from "@/features/accounts/kind-chooser/kind-panel-empty";
import { KindPanelFacts } from "@/features/accounts/kind-chooser/kind-panel-facts";
import { KindPanelSteps } from "@/features/accounts/kind-chooser/kind-panel-steps";
import styles from "@/features/accounts/kind-chooser/kind-panel.module.css";
import { KindScene } from "@/features/accounts/kind-chooser/kind-scene";
import {
  classOf,
  kindHint,
  kindTitle,
} from "@/features/accounts/model/account-kinds";
import type { Kind } from "@/features/accounts/model/account-kinds";
import { useT } from "@/i18n/i18n-provider";

interface KindPanelProps {
  kind: Kind | null;
  count: number;
}

// KC7: the kind chosen, drawn with what the form asks for and what the account becomes.
export function KindPanel({ kind, count }: KindPanelProps) {
  const t = useT();

  if (kind === null) return <KindPanelEmpty />;

  return (
    <aside className={styles.panel} aria-live="polite">
      <KindScene key={kind} kind={kind} heroName />

      <div className={styles.head}>
        <Heading level={3} size="md" wrap="nowrap">
          {t(kindTitle[kind])}
        </Heading>
        <Text size="sm" tone="muted" wrap="nowrap">
          {t(`kindPanel.${classOf(kind)}`)}
        </Text>
      </div>

      <Text size="sm" tone="muted" wrap="nowrap">
        {t(kindHint[kind])}
      </Text>

      <KindPanelSteps kind={kind} />

      <KindPanelFacts kind={kind} count={count} />
    </aside>
  );
}
