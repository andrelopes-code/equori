import { useRouterState } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";
import { bestMatch } from "@/ui/best-match";
import { BarControl } from "@/ui/bar-control";
import styles from "@/ui/bottom-bar.module.css";

export interface BottomBarItem {
  key: string;
  label: string;
  to?: string;
  search?: Record<string, string>;
  onPress?: () => void;
  // A count shown after the label, in the warning tone.
  badge?: string | undefined;
  // The one control drawn in ink: the entry of a new transaction (shell second pass S2).
  ink?: boolean;
}

type FiveItems = readonly [
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
];

// Families read: app-shell, side-navigation, top-navigation, tabs, action-bar.
// None draws a bar of text controls fixed to the bottom edge of a phone (ledger sheet L5), nor
// one control of the bar in ink.
export function BottomBar({ items }: { items: FiveItems }) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentPath = bestMatch(
    pathname,
    items.flatMap((item) => (item.to === undefined ? [] : [item.to])),
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
            <BarControl item={item} current={item.to === currentPath} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
