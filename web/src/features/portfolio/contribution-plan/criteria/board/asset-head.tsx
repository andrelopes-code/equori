import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";
import type { CSSProperties } from "react";

import styles from "@/features/portfolio/contribution-plan/criteria/board/board.module.css";
import type { BoardAsset } from "@/features/portfolio/contribution-plan/criteria/model/board-rows";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AssetHeadProps {
  asset: BoardAsset;
  // The number of criteria.
  count: number;
  // The greatest ideal of the board: the bars share its scale.
  greatest: number;
  // Opens the statements or the report of the asset; undefined when it has none.
  onOpen: (() => void) | undefined;
}

// The head of a column: the asset, its derived ideal, its points and the ideal as a bar.
export function AssetHead({ asset, count, greatest, onOpen }: AssetHeadProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const share = asset.ideal === undefined ? "" : shareText(asset.ideal, locale);
  const counted = { yes: String(asset.points), count: String(count) };
  const label =
    asset.points === undefined
      ? t("contributionPlan.criteria.idealOfEqual", { name: asset.name, share })
      : t("contributionPlan.criteria.idealOf", {
          name: asset.name,
          share,
          ...counted,
        });

  return (
    <div role="columnheader" aria-label={label} className={styles.asset}>
      {onOpen === undefined ? (
        <Text size="sm" weight="semibold" className={styles.assetName}>
          {asset.name}
        </Text>
      ) : (
        <Button
          inline
          size="sm"
          aria-label={t("contributionPlan.criteria.statementsOf", {
            name: asset.name,
          })}
          onClick={onOpen}
        >
          {asset.name}
        </Button>
      )}

      <Text size="lg" weight="semibold" className={styles.ideal}>
        {share}
      </Text>

      <Text size="xs" tone="muted" className={styles.points}>
        {asset.points === undefined
          ? t("contributionPlan.criteria.equalShare")
          : t("contributionPlan.criteria.points", counted)}
      </Text>

      <span aria-hidden="true" className={styles.idealTrack}>
        <span
          className={styles.idealFill}
          style={
            {
              display: "block",
              "--ideal": String(
                greatest === 0 ? 0 : (asset.ideal ?? 0) / greatest,
              ),
            } as CSSProperties
          }
        />
      </span>
    </div>
  );
}
