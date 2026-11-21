import type { components } from "@/api/schema.gen";
import { AccountFigures } from "@/features/accounts/account-record/account-figures";
import { BalanceChart } from "@/features/accounts/balance-chart/balance-chart";
import { HistoryChart } from "@/features/accounts/kind-figures/history-chart";
import { LoanFigures } from "@/features/accounts/kind-figures/loan-figures";
import { PropertyFigures } from "@/features/accounts/kind-figures/property-figures";
import { recordShape } from "@/features/accounts/kind-figures/record-shape";
import type { Range } from "@/features/accounts/model/account-search";
import { AccountYieldSection } from "@/features/portfolio";

type Account = components["schemas"]["Account"];

interface AccountOverviewProps {
  account: Account;
  scale: (code: string) => number;
  range: Range;
  onRange: (range: Range) => void;
  // A phone shows the yield here: it offers no yield tab (ADR 027, S5).
  compact: boolean;
}

// The figures and the chart above the tabs, in the form of the account's kind (K1 to K8).
export function AccountOverview({
  account,
  scale,
  range,
  onRange,
  compact,
}: AccountOverviewProps) {
  const shape = recordShape(account);
  const own = scale(account.currency);

  if (shape === "property") {
    return (
      <>
        <PropertyFigures account={account} scale={own} />
        <HistoryChart account={account} scale={own} />
      </>
    );
  }

  if (shape === "loan") {
    return (
      <>
        <LoanFigures account={account} scale={own} />
        <HistoryChart account={account} scale={own} />
      </>
    );
  }

  return (
    <>
      <AccountFigures account={account} scale={scale} />
      {compact && <AccountYieldSection accountId={account.id} />}
      <BalanceChart
        account={account}
        range={range}
        onRange={onRange}
        scale={own}
      />
    </>
  );
}
