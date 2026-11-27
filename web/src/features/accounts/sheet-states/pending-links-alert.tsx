import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";
import { useServed } from "@/ui/navigation/use-served";

const links = { to: "/accounts/links" } as const;

interface PendingLinksAlertProps {
  // The external accounts that wait for a link to an account of the book.
  pending: number;
}

export function PendingLinksAlert({ pending }: PendingLinksAlertProps) {
  const t = useT();
  const navigate = useNavigate();
  const served = useServed();

  if (pending === 0) return null;

  return (
    <Alert tone="accent">
      <AlertContent>
        <AlertDescription>
          {t("balanceSheet.pendingLinks", { count: pending })}
        </AlertDescription>
      </AlertContent>

      {served(links) && (
        <AlertActions>
          <Button
            onClick={() => {
              void navigate(links);
            }}
          >
            {t("balanceSheet.reviewLinks")}
          </Button>
        </AlertActions>
      )}
    </Alert>
  );
}
