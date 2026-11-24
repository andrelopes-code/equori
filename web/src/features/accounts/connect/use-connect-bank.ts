import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  useCreateConnectToken,
  useCreateConnection,
} from "@/features/accounts/api";
import type { ConnectLauncher } from "@/features/accounts/connect/connect-launchers";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Connection = components["schemas"]["Connection"];

interface ConnectRequest {
  integrationId: string;
  name: string;
  launcher: ConnectLauncher;
}

// The aggregator's dialog, then the registration of the item it answers. An item whose
// registration failed is kept, so a retry needs no second login.
export function useConnectBank() {
  const t = useT();
  const [locale] = useAppLocale();
  const token = useCreateConnectToken();
  const create = useCreateConnection();
  const [launching, setLaunching] = useState(false);
  const [item, setItem] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function register(request: ConnectRequest, externalId: string) {
    const created = await create.mutateAsync({
      integration_id: request.integrationId,
      external_id: externalId,
      name: request.name,
    });

    setItem(null);
    setConnection(created);
  }

  async function run(request: ConnectRequest) {
    if (item !== null) {
      await register(request, item);
      return;
    }

    const answer = await token.mutateAsync(request.integrationId);

    setLaunching(true);
    const created = await request.launcher
      .launch(answer.token, locale.slice(0, 2))
      .finally(() => {
        setLaunching(false);
      });

    if (created === null) return;

    setItem(created);
    await register(request, created);
  }

  function start(request: ConnectRequest) {
    setError(null);
    run(request).catch((caught: unknown) => {
      setError(errorText(caught, t));
    });
  }

  function reset() {
    setConnection(null);
    setError(null);
  }

  return {
    start,
    reset,
    launching,
    pending: token.isPending || create.isPending,
    retry: item !== null,
    connection,
    error,
  };
}
