import { useT } from "@/i18n/i18n-provider";
import { BarControl } from "@/ui/bar-control";
import styles from "@/ui/bottom-bar.module.css";
import type { NavGlyphName } from "@/ui/nav-glyph";
import { useTabSelection } from "@/ui/use-tab-selection";

export interface BottomBarItem {
  key: string;
  label: string;
  glyph: NavGlyphName;
  to?: string;
  onPress?: () => void;
  // A count shown on the glyph's corner.
  badge?: string | undefined;
  // The one control in the accent solid: the entry of a new transaction.
  primary?: boolean;
}

type FiveItems = readonly [
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
];

// Families read: app-shell, side-navigation, top-navigation, tabs, action-bar. The tab bar is
// equori's own by choice: it is drawn as a phone's own bar, which
// no family is meant to imitate.
export function BottomBar({
  items,
  onReselect,
}: {
  items: FiveItems;
  // A tap on the selected tab at its own route (N5).
  onReselect?: () => void;
}) {
  const t = useT();
  const tabs = useTabSelection(
    items.flatMap((item) => (item.to === undefined ? [] : [item.to])),
    onReselect,
  );
  return (
    <nav
      aria-label={t("nav.label")}
      data-own="bottom-bar"
      className={styles.bar}
    >
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key} className={styles.item}>
            <BarControl
              item={item}
              current={item.to !== undefined && item.to === tabs.current}
              selected={item.to !== undefined && item.to === tabs.selected}
              link={item.to === undefined ? undefined : tabs.link(item.to)}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
