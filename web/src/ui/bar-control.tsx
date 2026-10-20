import { Badge } from "@slotted/react/badge";

import type { BottomBarItem } from "@/ui/bottom-bar";
import styles from "@/ui/bottom-bar.module.css";
import { NavGlyph } from "@/ui/nav-glyph";
import type { TabSelection } from "@/ui/use-tab-selection";

export function BarControl({
  item,
  current,
  selected,
  link,
}: {
  item: BottomBarItem;
  current: boolean;
  selected: boolean;
  link: ReturnType<TabSelection["link"]> | undefined;
}) {
  const content = (
    <>
      <span className={styles.glyph}>
        <NavGlyph name={item.glyph} filled={selected} />
      </span>
      <span className={styles.label}>{item.label}</span>
      {/* After the label in reading order; drawn on the glyph's corner. */}
      {item.badge !== undefined && (
        <span data-own="bar-count" className={styles.count}>
          <Badge size="sm" tone="secondary" variant="solid">
            {item.badge}
          </Badge>
        </span>
      )}
    </>
  );
  const primary = item.primary === true ? { "data-emphasis": "primary" } : {};
  if (link !== undefined) {
    return (
      <a
        {...link}
        className={styles.control}
        aria-current={current ? "page" : undefined}
        {...(selected ? { "data-selected": "" } : {})}
        {...primary}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={styles.control}
      onClick={item.onPress}
      {...primary}
    >
      {content}
    </button>
  );
}
