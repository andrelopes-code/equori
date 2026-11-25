import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";
import type { RefObject } from "react";

import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useT } from "@/i18n/i18n-provider";

// The choice between one asset and every asset of its group.
export interface PanelScope {
  whole: boolean;
  asset: string;
  count: number;
  onWhole: (whole: boolean) => void;
}

interface PanelHeadProps {
  group: number;
  name: string;
  // The name of the group beside an asset; "" for the group itself.
  groupName: string;
  scope: PanelScope | undefined;
  // The title takes the focus when the reader opens the panel.
  titleRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

// The head of the panel: what it shows, the choice of the scope and the way out.
export function PanelHead({
  group,
  name,
  groupName,
  scope,
  titleRef,
  onClose,
}: PanelHeadProps) {
  const t = useT();

  return (
    <div className={styles.panelHead}>
      <GroupDot position={group} shape="square" />

      <div ref={titleRef} tabIndex={-1} className={styles.panelTitle}>
        <Text size="md" weight="semibold">
          {name}
        </Text>
      </div>

      <Text size="sm" tone="muted" className={styles.panelGroup}>
        {groupName}
      </Text>

      {scope !== undefined && (
        <SegmentedControl
          aria-label={t("contributionPlan.panel.scope")}
          value={scope.whole ? "group" : "asset"}
          onValueChange={(next) => {
            scope.onWhole(next === "group");
          }}
        >
          <Segment value="asset">
            {t("contributionPlan.panel.onlyAsset", { name: scope.asset })}
          </Segment>

          <Segment value="group">
            {t("contributionPlan.panel.allAssets", {
              count: String(scope.count),
            })}
          </Segment>
        </SegmentedControl>
      )}

      <IconButton
        size="sm"
        variant="ghost"
        tone="secondary"
        aria-label={t("contributionPlan.panel.close")}
        onClick={onClose}
      >
        <Icon>
          <Glyph name="x" />
        </Icon>
      </IconButton>
    </div>
  );
}
