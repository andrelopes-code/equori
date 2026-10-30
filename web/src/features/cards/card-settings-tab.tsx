import type { components } from "@/api/schema.gen";
import { BillingCycleSection } from "@/features/cards/billing-cycle-section";
import styles from "@/features/cards/card-settings-tab.module.css";
import { CreditLimitSection } from "@/features/cards/credit-limit-section";

type Account = components["schemas"]["Account"];

interface CardSettingsTabProps {
  account: Account;
  ruleOpen: boolean;
  onRuleOpen: (open: boolean) => void;
  scale: (code: string) => number;
}

// The card's billing cycle and limit, each a history of versions (T05).
export function CardSettingsTab({
  account,
  ruleOpen,
  onRuleOpen,
  scale,
}: CardSettingsTabProps) {
  return (
    <div className={styles.frame}>
      <div className={styles.sections}>
        <BillingCycleSection
          accountId={account.id}
          ruleOpen={ruleOpen}
          onRuleOpen={onRuleOpen}
        />
        <CreditLimitSection account={account} scale={scale} />
      </div>
    </div>
  );
}
