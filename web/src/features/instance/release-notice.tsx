import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Link } from "@slotted/react/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { versionQuery } from "@/features/instance/api";
import { UpgradeDialog } from "@/features/instance/upgrade-dialog";
import { useReleaseDismissal } from "@/features/instance/use-release-dismissal";
import { meQuery } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

// A159, A195: tells an admin that a newer release exists and how to upgrade, until that release
// is dismissed.
export function ReleaseNotice() {
  const t = useT();
  const api = useApi();
  // The router has loaded /me before the overview draws; the notice reuses that answer.
  const admin =
    useQuery({ ...meQuery(api), staleTime: Infinity }).data?.role === "admin";
  const version = useQuery({ ...versionQuery(api), enabled: admin });
  const [dismissed, dismiss] = useReleaseDismissal();
  const [upgrading, setUpgrading] = useState(false);

  const latest = version.data?.latest;

  if (!admin || version.data?.newer !== true) return null;
  if (latest === null || latest === undefined || latest.version === dismissed) {
    return null;
  }

  const handleDismiss = () => {
    dismiss(latest.version);
  };

  return (
    <Alert tone="info">
      <AlertContent>
        <AlertDescription>
          {t("overview.release", {
            version: latest.version,
            current: version.data.version,
          })}{" "}
          <Link href={latest.url} target="_blank" rel="noreferrer">
            {t("overview.release.notes")}
          </Link>
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button
          onClick={() => {
            setUpgrading(true);
          }}
        >
          {t("overview.release.upgrade")}
        </Button>
        <Button variant="ghost" onClick={handleDismiss}>
          {t("overview.release.dismiss")}
        </Button>
      </AlertActions>

      {upgrading && (
        <UpgradeDialog
          version={latest.version}
          distribution={version.data.distribution}
          onClose={() => {
            setUpgrading(false);
          }}
        />
      )}
    </Alert>
  );
}
