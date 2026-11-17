import type { ComponentProps } from "react";

import { cx } from "@/ui/cx";
import styles from "@/ui/page-layout/page-stack.module.css";

type PageStackProps = ComponentProps<"div">;

// O19: the column of a page's blocks, at the gaps of app.css (spec 2026-11-17-page-spacing, PS2).
export function PageStack({ className, ...props }: PageStackProps) {
  return <div {...props} className={cx(styles.stack, className)} />;
}
