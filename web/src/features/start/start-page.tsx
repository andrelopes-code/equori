import { Page, PageBody } from "@slotted/react/page";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import { StartScreen } from "@/features/start/start-screen";

// The walkthrough starts from the base currency and the account list, so it waits for both.
export function StartPage() {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const scale = useScale();
  const base = settings.data?.base_currency;

  if (
    accounts.data === undefined ||
    base === undefined ||
    instruments.data === undefined ||
    scale === null
  ) {
    return (
      <Page width="wide">
        <PageBody>
          <Stack gap={6} aria-busy="true">
            {[40, 55, 30].map((width) => (
              <Skeleton
                key={width}
                shape="block"
                blockSize="2.5rem"
                inlineSize={`${String(width)}%`}
              />
            ))}
          </Stack>
        </PageBody>
      </Page>
    );
  }

  return <StartScreen base={base} scale={scale} />;
}
