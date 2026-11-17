import type { components } from "@/api/schema.gen";
import { CardAppearanceSection } from "@/features/cards/card-appearance/card-appearance-section";
import { BillingCycleSection } from "@/features/cards/card-settings-tab/billing-cycle-section";
import styles from "@/features/cards/card-settings-tab/card-settings-tab.module.css";
import { CreditLimitSection } from "@/features/cards/card-settings-tab/credit-limit-section";

type Account = components["schemas"]["Account"];
type Institution = components["schemas"]["Institution"];

interface CardSettingsTabProps {
  account: Account;
  institution: Institution | undefined;
  ruleOpen: boolean;
  onRuleOpen: (open: boolean) => void;
  scale: (code: string) => number;
}

// The card's appearance, then its billing cycle and limit, each a history of versions (T05).
export function CardSettingsTab({
  account,
  institution,
  ruleOpen,
  onRuleOpen,
  scale,
}: CardSettingsTabProps) {
  return (
    <div className={styles.frame}>
      <div className={styles.sections}>
        <div className={styles.appearance}>
          <CardAppearanceSection account={account} institution={institution} />
        </div>

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
