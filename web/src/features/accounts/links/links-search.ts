export interface LinksSearch {
  // The external account whose link drawer is open, on its connection, with the account chosen.
  external?: string;
  connection?: string;
  account?: string;
  // The connect dialog: the integration to connect through, or "new" for the first one.
  connect?: string;
}

const uuid = /^[0-9a-f-]{36}$/u;

function id(value: unknown): string | undefined {
  return typeof value === "string" && uuid.test(value) ? value : undefined;
}

export function validateLinksSearch(raw: Record<string, unknown>): LinksSearch {
  const external = id(raw.external);
  const connection = id(raw.connection);
  const account = id(raw.account);
  const connect = raw.connect === "new" ? "new" : id(raw.connect);
  return {
    ...(external === undefined ? {} : { external }),
    ...(connection === undefined ? {} : { connection }),
    ...(account === undefined ? {} : { account }),
    ...(connect === undefined ? {} : { connect }),
  };
}
