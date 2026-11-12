import { Switch } from "@slotted/react/switch";

import styles from "@/features/transactions/transaction-filters/voided-switch.module.css";
import { useT } from "@/i18n/i18n-provider";

interface VoidedSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function VoidedSwitch({ checked, onCheckedChange }: VoidedSwitchProps) {
  const t = useT();

  return (
    <div className={styles.root}>
      <Switch size="sm" checked={checked} onCheckedChange={onCheckedChange}>
        {t("transactions.showVoided")}
      </Switch>
    </div>
  );
}
