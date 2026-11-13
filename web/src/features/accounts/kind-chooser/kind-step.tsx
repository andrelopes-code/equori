import { KindChooser } from "@/features/accounts/kind-chooser/kind-chooser";
import { kindCounts } from "@/features/accounts/kind-chooser/kind-count";
import { KindPanel } from "@/features/accounts/kind-chooser/kind-panel";
import styles from "@/features/accounts/kind-chooser/kind-step.module.css";
import type { components } from "@/api/schema.gen";
import type { Kind } from "@/features/accounts/model/account-kinds";

type Account = components["schemas"]["Account"];

interface KindStepProps {
  accounts: readonly Account[];
  value: Kind | null;
  onChange: (kind: Kind) => void;
  onContinue: () => void;
}

// KC1: the gallery, then the panel of 25rem.
export function KindStep({
  accounts,
  value,
  onChange,
  onContinue,
}: KindStepProps) {
  const counts = kindCounts(accounts);

  return (
    <div className={styles.split}>
      <KindChooser
        value={value}
        counts={counts}
        onChange={onChange}
        onContinue={onContinue}
      />

      <KindPanel kind={value} count={value === null ? 0 : counts[value]} />
    </div>
  );
}
