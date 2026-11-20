import type { CompareData } from "@/features/assistant/view/forms/bars/compare-rows";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { windowText } from "@/features/assistant/view/window-text";
import { useAppLocale } from "@/i18n/i18n-provider";

interface CompareLegendProps {
  periods: CompareData["periods"];
}

// The legend of two periods: the earlier in the reference tone, the later in the accent.
export function CompareLegend({ periods }: CompareLegendProps) {
  const [locale] = useAppLocale();

  return (
    <ul className={styles.legend}>
      <li>
        <i className={styles.keyRef} />
        {windowText(periods[0], locale)}
      </li>
      <li>
        <i className={styles.key} />
        {windowText(periods[1], locale)}
      </li>
    </ul>
  );
}
