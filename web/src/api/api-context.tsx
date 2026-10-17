import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Client } from "openapi-fetch";

import type { paths } from "@/api/schema.gen";

const ApiContext = createContext<Client<paths> | null>(null);

export function ApiProvider({
  client,
  children,
}: {
  client: Client<paths>;
  children: ReactNode;
}) {
  return <ApiContext value={client}>{children}</ApiContext>;
}

export function useApi(): Client<paths> {
  const client = useContext(ApiContext);
  if (client === null) {
    throw new Error("useApi requires an ApiProvider");
  }
  return client;
}
