import { Link } from "@tanstack/react-router";

import styles from "@/ui/bottom-bar.module.css";
import type { BottomBarItem } from "@/ui/bottom-bar";

export function BarControl({
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
