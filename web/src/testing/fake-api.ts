type Route = (req: Request) => Response | Promise<Response>;

export type FakeFetch = typeof fetch & { calls: string[] };

const statusTitles: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function problem(
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
): Response {
  const body = {
    type: "about:blank",
    title: statusTitles[status] ?? String(status),
    status,
    ...extra,
    code,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

export function fakeApi(routes: Record<string, Route>): FakeFetch {
  const calls: string[] = [];
  const impl = (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const key = `${req.method} ${new URL(req.url).pathname}`;
    const route = routes[key];
    if (route === undefined) {
      calls.push(key);
      return Promise.resolve(problem(404, "not_found"));
    }
    return Promise.resolve(route(req));
  };
  return Object.assign(impl, { calls });
}
