export interface SourceLink {
  url: string;
  title: string;
  host: string;
}

interface SourcesData {
  sources?: { url: string; title: string }[];
}

// The pages a view of sources links (web search design, S7): each source whose address is http
// or https, with the host that tells where the link leads.
export function sourceLinks(data: unknown): SourceLink[] {
  const sources = (data as SourcesData | undefined)?.sources ?? [];

  return sources.flatMap((s) => {
    const host = webHost(s.url);

    return host === undefined ? [] : [{ url: s.url, title: s.title, host }];
  });
}

function webHost(address: string): string | undefined {
  if (!URL.canParse(address)) return undefined;

  const url = new URL(address);

  return url.protocol === "http:" || url.protocol === "https:"
    ? url.host
    : undefined;
}
