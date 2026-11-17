import styles from "@/app/shell/calculator/calculator.module.css";
import { keyRows } from "@/app/shell/calculator/key-rows";
import type { KeyAction } from "@/app/shell/calculator/use-account";
import { ShellIcon } from "@/app/shell/destinations/shell-icon";
import { useT } from "@/i18n/i18n-provider";

interface CalculatorKeysProps {
  // The decimal separator of the active tag, the legend of its key.
  decimal: string;
  onPress: (action: KeyAction) => void;
}

// Twenty keys in four columns.
export function CalculatorKeys({ decimal, onPress }: CalculatorKeysProps) {
  const t = useT();

  return (
    <div className={styles.keys} data-part="keys">
      {keyRows.map((key) => (
        <button
          key={key.id}
          type="button"
          className={styles.key}
          data-kind={key.kind}
          aria-label={key.name === undefined ? undefined : t(key.name)}
          onClick={() => {
            onPress(key.action);
          }}
        >
          {key.id === "erase" && <ShellIcon name="erase" size={16} />}
          {key.id === "decimal" && decimal}
          {key.legend}
        </button>
      ))}
    </div>
  );
}
