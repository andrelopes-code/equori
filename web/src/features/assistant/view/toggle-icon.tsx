import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/view/answer-view.module.css";

interface ToggleIconProps {
  name: "chart" | "table";
}

// The 14 px glyph of an option of the chart/table switch.
export function ToggleIcon({ name }: ToggleIconProps) {
  return (
    <span className={styles.icon14}>
      <AssistantIcon name={name} />
    </span>
  );
}
