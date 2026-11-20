import { IndicatorTile } from "@/features/assistant/view/forms/charts/indicator-tile";
import type { IndicatorsData } from "@/features/assistant/view/forms/charts/indicators-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";

// The month in three ratios, each a tile with its months as a sparkline.
export function IndicatorsBody({ data }: FormBodyProps) {
  const { tiles } = data as IndicatorsData;

  return (
    <div className={styles.tiles}>
      {tiles.map((tile) => (
        <IndicatorTile key={tile.kind} tile={tile} />
      ))}
    </div>
  );
}
