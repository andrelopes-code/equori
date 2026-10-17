import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";
import { bestMatch } from "@/ui/best-match";
import styles from "@/ui/bottom-bar.module.css";

export interface BottomBarItem {
  key: string;
  label: string;
  icon: ReactNode;
  to?: string;
  onPress?: () => void;
  emphasized?: boolean;
}

type FiveItems = readonly [
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
  BottomBarItem,
];

// Families read: app-shell, side-navigation, top-navigation, tabs, action-bar.
// None draws a five-control bar fixed to the bottom edge of a phone.
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

function BarControl({
  item,
  current,
}: {
  item: BottomBarItem;
  current: boolean;
}) {
  const emphasis = item.emphasized === true ? { "data-emphasized": "" } : {};
  const content = (
    <>
      {item.icon}
      <span className={styles.label}>{item.label}</span>
    </>
  );
  if (item.to !== undefined) {
    return (
      <Link
        to={item.to}
        className={styles.control}
        // Link marks only exact paths; aria-current below covers nested routes.
        activeOptions={{ exact: true }}
        aria-current={current ? "page" : undefined}
        {...emphasis}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={styles.control}
      onClick={item.onPress}
      {...emphasis}
    >
      {content}
    </button>
  );
}
